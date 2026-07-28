import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadConfig,
  PORTAL_PROFILE_NAME,
  savePortalSession,
  upsertProfile,
} from "../core/config.js";
import { getTokens, saveTokens, setBackendForTesting, type KeychainBackend } from "../core/keychain.js";
import { runLogout } from "./logout.js";

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

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-logout-"));
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.SEAMLESS_PROFILE;
  delete process.env.SEAMLESS_REFRESH_TOKEN;

  setBackendForTesting(fakeBackend());
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setBackendForTesting(null);
  fs.rmSync(configHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.SEAMLESS_PORTAL_AUTH_URL;
});

describe("runLogout: portal", () => {
  const portalUrl = "https://portal.example.com";
  const portalTarget = { name: PORTAL_PROFILE_NAME, instanceUrl: portalUrl };

  beforeEach(() => {
    process.env.SEAMLESS_PORTAL_AUTH_URL = portalUrl;
  });

  it("revokes and clears the portal session by default", async () => {
    savePortalSession({ instanceUrl: portalUrl, email: "dev@example.com" });
    await saveTokens(portalTarget, { accessToken: "a", refreshToken: "r" });
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "ia", refreshToken: "ir" });

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json({ ok: true });
      }),
    );

    await runLogout([]);

    expect(calls[0]).toBe(`${portalUrl}/logout`);
    expect(await getTokens(portalTarget)).toBeNull();
    expect(loadConfig().portal).toBeUndefined();
    // The instance session is a separate account and must survive.
    expect(await getTokens(profile)).not.toBeNull();
    expect(logs().some((l) => l.includes("Logged out."))).toBe(true);
  });

  it("clears a stale portal session without a live token", async () => {
    savePortalSession({ instanceUrl: portalUrl });

    await runLogout([]);

    expect(loadConfig().portal).toBeUndefined();
    expect(logs().some((l) => l.includes("You are already logged out."))).toBe(
      true,
    );
  });

  it("targets an instance when --profile is given", async () => {
    savePortalSession({ instanceUrl: portalUrl });
    await saveTokens(portalTarget, { accessToken: "a", refreshToken: "r" });
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "ia", refreshToken: "ir" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ ok: true })),
    );

    await runLogout(["--profile", "default"]);

    expect(await getTokens(profile)).toBeNull();
    expect(loadConfig().portal).toBeDefined();
    expect(await getTokens(portalTarget)).not.toBeNull();
  });
});

function logs(): string[] {
  return logSpy.mock.calls.map((c) => c[0] as string);
}

describe("runLogout", () => {
  it("does nothing when there is no active profile", async () => {
    await runLogout([]);
    expect(logs().some((l) => l.includes("No session to log out of."))).toBe(
      true,
    );
  });

  it("clears the local session and reports already logged out on reauth failure", async () => {
    upsertProfile(profile);
    // No tokens saved, so createAuthClient throws ReauthRequiredError.
    await runLogout([]);
    expect(logs().some((l) => l.includes("You are already logged out."))).toBe(true);
  });

  it("rethrows unexpected errors while creating the auth client", async () => {
    upsertProfile(profile);
    setBackendForTesting({
      get: () => {
        throw new Error("disk read failed");
      },
      set: () => {},
      delete: () => false,
    });

    await expect(runLogout([])).rejects.toThrow("disk read failed");
  });

  it("revokes the current session and clears local tokens", async () => {
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "access", refreshToken: "refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "ok" })),
    );

    await runLogout([]);

    expect(logs().some((l) => l.includes("Logged out."))).toBe(true);
    expect(await getTokens(profile)).toBeNull();
  });

  it("revokes every session with --all", async () => {
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "access", refreshToken: "refresh" });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json({ message: "ok" });
      }),
    );

    await runLogout(["--all"]);

    expect(calls[0]).toBe("https://auth.example.com/logout/all");
    expect(logs().some((l) => l.includes("Logged out of all sessions."))).toBe(true);
  });

  it("honors --profile alongside --all", async () => {
    const other = { name: "other", instanceUrl: "https://other.example.com" };
    upsertProfile(profile);
    upsertProfile(other);
    await saveTokens(other, { accessToken: "a2", refreshToken: "r2" });

    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json({ message: "ok" });
      }),
    );

    await runLogout(["--all", "--profile", "other"]);

    expect(calls[0]).toBe("https://other.example.com/logout/all");
  });

  it("treats a reauth error during revoke as already revoked", async () => {
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "old-access", refreshToken: "old-refresh" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        // Both the initial call and the refresh attempt fail, so revokeSession
        // surfaces a ReauthRequiredError from within the authed client.
        new Response(null, { status: 401 }),
      ),
    );

    await runLogout([]);

    expect(logs().some((l) => l.includes("Logged out."))).toBe(true);
  });

  it("reports a problem revoking when the instance responds with a non-ok status", async () => {
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "access", refreshToken: "refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "nope" }, 500)),
    );

    await runLogout([]);

    expect(
      logs().some((l) =>
        l.includes("Cleared the local session. The instance reported a problem revoking the session."),
      ),
    ).toBe(true);
  });

  it("rethrows unexpected errors during revoke", async () => {
    upsertProfile(profile);
    await saveTokens(profile, { accessToken: "access", refreshToken: "refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(runLogout([])).rejects.toThrow("network down");
  });
});
