import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => {
  const CANCEL = Symbol("cancel");
  return {
    CANCEL,
    intro: vi.fn(),
    outro: vi.fn(),
    text: vi.fn(),
    isCancel: (value: unknown) => value === CANCEL,
    cancel: vi.fn(),
  };
});

import { CANCEL, cancel, intro, outro, text } from "@clack/prompts";
import { loadConfig, upsertProfile } from "../core/config.js";
import {
  KeychainUnavailableError,
  getTokens,
  setBackendForTesting,
  type KeychainBackend,
} from "../core/keychain.js";
import { runLogin } from "./login.js";

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

interface Call {
  url: string;
  init: RequestInit;
}

function mockRouter(routes: Record<string, Array<() => Response>>): Call[] {
  const calls: Call[] = [];
  const queues = new Map<string, Array<() => Response>>(Object.entries(routes));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const key = Object.keys(routes).find((p) => url.endsWith(p));
      if (!key) throw new Error(`No route for ${url}`);
      const queue = queues.get(key)!;
      const responder = queue.length > 1 ? queue.shift()! : queue[0];
      return responder();
    }),
  );

  return calls;
}

const profile = { name: "default", instanceUrl: "https://auth.example.com" };

let configHome: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-login-"));
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.SEAMLESS_PROFILE;
  delete process.env.SEAMLESS_REFRESH_TOKEN;

  setBackendForTesting(fakeBackend());

  vi.mocked(text).mockReset();
  vi.mocked(intro).mockClear();
  vi.mocked(outro).mockClear();
  vi.mocked(cancel).mockClear();

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

function logs(): string[] {
  return logSpy.mock.calls.map((c) => c[0] as string);
}

describe("runLogin: no active profile", () => {
  it("errors and exits 1", async () => {
    await expect(runLogin([])).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No active profile is configured."),
    );
    expect(logs().some((l) => l.includes("seamless profile add"))).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("runLogin: identifier prompt", () => {
  beforeEach(() => {
    upsertProfile(profile);
  });

  it("cancels when the identifier prompt is cancelled", async () => {
    vi.mocked(text).mockResolvedValueOnce(CANCEL);

    await runLogin([]);

    expect(cancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("uses the --identifier flag without prompting", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [
        () => json({ token: "a", refreshToken: "r", sub: "user-1", email: "dev@example.com" }),
      ],
    });
    vi.mocked(text).mockResolvedValueOnce("123456");

    await runLogin(["--identifier", "dev@example.com"]);

    // Only the code prompt should have run, not the identifier prompt.
    expect(vi.mocked(text)).toHaveBeenCalledTimes(1);
  });

  it("uses a positional identifier without prompting", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });
    vi.mocked(text).mockResolvedValueOnce("123456");

    await runLogin(["dev@example.com"]);

    expect(vi.mocked(text)).toHaveBeenCalledTimes(1);
  });
});

describe("runLogin: success", () => {
  beforeEach(() => {
    upsertProfile(profile);
  });

  it("logs in, saves tokens, and updates the profile", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [
        () =>
          json({
            token: "access-1",
            refreshToken: "refresh-1",
            sub: "user-1",
            email: "dev@example.com",
          }),
      ],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce("123456");

    await runLogin([]);

    const stored = await getTokens(profile);
    expect(stored?.accessToken).toBe("access-1");
    expect(stored?.refreshToken).toBe("refresh-1");

    const updated = loadConfig().profiles.default;
    expect(updated.sub).toBe("user-1");
    expect(updated.email).toBe("dev@example.com");
    expect(updated.identifierType).toBe("email");

    expect(outro).toHaveBeenCalledWith(expect.stringContaining("Logged in as dev@example.com."));
  });

  it("falls back to the identifier in the outro message when the response omits email", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce("123456");

    await runLogin([]);

    expect(outro).toHaveBeenCalledWith(expect.stringContaining("Logged in as dev@example.com."));
  });

  it("cancels when the code prompt is cancelled", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce(CANCEL);

    await runLogin([]);

    expect(cancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("notifies on an incorrect code with correct pluralization, then succeeds", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [
        () => json({ error: "Not allowed" }, 401),
        () => json({ error: "Not allowed" }, 401),
        () => json({ token: "a", refreshToken: "r" }),
      ],
    });
    vi.mocked(text)
      .mockResolvedValueOnce("dev@example.com")
      .mockResolvedValueOnce("000000")
      .mockResolvedValueOnce("000000")
      .mockResolvedValueOnce("123456");

    await runLogin([]);

    const out = logs();
    expect(out.some((l) => l.includes("2 attempts left"))).toBe(true);
    expect(out.some((l) => l.includes("1 attempt left"))).toBe(true);
    expect(out.some((l) => l.includes("A code was sent to dev@example.com."))).toBe(true);
  });

  it("validates the code prompt input", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce("123456");

    await runLogin([]);

    const codeCall = vi.mocked(text).mock.calls[1][0] as {
      validate: (v: string) => string | undefined;
    };
    expect(codeCall.validate("123456")).toBeUndefined();
    expect(codeCall.validate("abc")).toMatch(/numeric code/);
  });

  it("validates the identifier prompt input", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce("123456");

    await runLogin([]);

    const idCall = vi.mocked(text).mock.calls[0][0] as {
      validate: (v: string) => string | undefined;
    };
    expect(idCall.validate("")).toBe("An identifier is required");
    expect(idCall.validate("dev@example.com")).toBeUndefined();
  });

  it("notifies when the ephemeral code window expires and a new code is sent", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
        () => json({ token: "e2", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });

    let askedCode = false;
    vi.mocked(text).mockImplementation(async (opts: unknown) => {
      const message = (opts as { message: string }).message;
      if (message === "Email or phone") return "dev@example.com";
      if (!askedCode) {
        askedCode = true;
        now += 6 * 60 * 1000;
        return "111111";
      }
      return "654321";
    });

    await runLogin([]);

    expect(logs().some((l) => l.includes("Your previous code expired"))).toBe(true);
  });
});

describe("runLogin: failure handling", () => {
  beforeEach(() => {
    upsertProfile(profile);
  });

  it("exits 1 with a red message on a LoginError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    vi.mocked(text).mockResolvedValueOnce("dev@example.com");

    await expect(runLogin([])).rejects.toThrow("exit:1");
    expect(outro).toHaveBeenCalledWith(expect.stringContaining("Could not reach"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 with a red message when the keychain is unavailable", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce("123456");

    setBackendForTesting({
      get: () => null,
      set: () => {
        throw new KeychainUnavailableError();
      },
      delete: () => false,
    });

    await expect(runLogin([])).rejects.toThrow("exit:1");
    expect(outro).toHaveBeenCalledWith(expect.stringContaining("No OS keychain is available"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("propagates unexpected errors", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });
    vi.mocked(text).mockResolvedValueOnce("dev@example.com").mockResolvedValueOnce("123456");

    setBackendForTesting({
      get: () => null,
      set: () => {
        throw new Error("disk on fire");
      },
      delete: () => false,
    });

    await expect(runLogin([])).rejects.toThrow("disk on fire");
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
