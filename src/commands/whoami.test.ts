import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertProfile } from "../core/config.js";
import { saveTokens, setBackendForTesting, type KeychainBackend } from "../core/keychain.js";
import { runWhoami } from "./whoami.js";

function fakeBackend(): KeychainBackend {
  const store = new Map<string, string>();
  return {
    get: (account) => store.get(account) ?? null,
    set: (account, secret) => {
      store.set(account, secret);
    },
    delete: (account) => store.delete(account),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const profile = { name: "default", instanceUrl: "https://auth.example.com" };

let configHome: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-whoami-"));
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.SEAMLESS_PROFILE;
  delete process.env.SEAMLESS_REFRESH_TOKEN;

  setBackendForTesting(fakeBackend());
  upsertProfile(profile);
  await saveTokens(profile, { accessToken: "access", refreshToken: "refresh" });

  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setBackendForTesting(null);
  fs.rmSync(configHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
});

describe("runWhoami", () => {
  it("prints the identity for the active profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          user: { id: "user-1", email: "dev@example.com", roles: ["admin", "user"] },
        }),
      ),
    );

    await runWhoami([]);

    const lines = logSpy.mock.calls.map((c) => c[0] as string);
    expect(lines.some((l) => l.includes("Profile") && l.includes("default"))).toBe(true);
    expect(lines.some((l) => l.includes("Instance") && l.includes(profile.instanceUrl))).toBe(
      true,
    );
    expect(lines.some((l) => l.includes("Sub") && l.includes("user-1"))).toBe(true);
    expect(lines.some((l) => l.includes("Email") && l.includes("dev@example.com"))).toBe(true);
    expect(lines.some((l) => l.includes("Roles") && l.includes("admin, user"))).toBe(true);
  });

  it("falls back to the profile's sub/email and (unknown)/(none) when identity omits them", async () => {
    upsertProfile({ ...profile, sub: "profile-sub", email: "profile@example.com" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ user: {} })),
    );

    await runWhoami([]);

    const lines = logSpy.mock.calls.map((c) => c[0] as string);
    expect(lines.some((l) => l.includes("Sub") && l.includes("profile-sub"))).toBe(true);
    expect(lines.some((l) => l.includes("Email") && l.includes("profile@example.com"))).toBe(
      true,
    );
    expect(lines.some((l) => l.includes("Roles") && l.includes("(none)"))).toBe(true);
  });

  it("shows (unknown) when neither identity nor profile has sub/email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ user: {} })),
    );

    await runWhoami([]);

    const lines = logSpy.mock.calls.map((c) => c[0] as string);
    expect(lines.some((l) => l.includes("Sub") && l.includes("(unknown)"))).toBe(true);
    expect(lines.some((l) => l.includes("Email") && l.includes("(unknown)"))).toBe(true);
  });

  it("exits 1 with a yellow message when reauth is required", async () => {
    setBackendForTesting({
      get: () => null,
      set: () => {},
      delete: () => false,
    });

    await expect(runWhoami([])).rejects.toThrow("exit:1");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Run: seamless login."));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 with a red error on other failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(null, 500)),
    );

    await expect(runWhoami([])).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not load your identity"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("honors the --profile flag", async () => {
    const other = { name: "other", instanceUrl: "https://other.example.com" };
    upsertProfile(other);
    await saveTokens(other, { accessToken: "a2", refreshToken: "r2" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ user: { id: "other-user", roles: [] } })),
    );

    await runWhoami(["--profile", "other"]);

    const lines = logSpy.mock.calls.map((c) => c[0] as string);
    expect(lines.some((l) => l.includes("Profile") && l.includes("other"))).toBe(true);
    expect(lines.some((l) => l.includes("other-user"))).toBe(true);
  });
});
