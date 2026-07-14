import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertProfile } from "./config.js";
import { isRateLimited } from "./http.js";
import {
  getTokens,
  saveTokens,
  setBackendForTesting,
  type KeychainBackend,
} from "./keychain.js";
import {
  createAuthClient,
  ReauthRequiredError,
  tokensFromAuthResponse,
} from "./authClient.js";

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

function mockFetch(makers: Array<() => Response>): Call[] {
  const calls: Call[] = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const make = makers[Math.min(i, makers.length - 1)];
      i++;
      return make();
    }),
  );
  return calls;
}

function authHeader(call: Call): string | undefined {
  return (call.init.headers as Record<string, string> | undefined)
    ?.Authorization;
}

const profile = { name: "default", instanceUrl: "https://auth.example.com" };
let configHome: string;

beforeEach(async () => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-http-"));
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.SEAMLESS_REFRESH_TOKEN;
  setBackendForTesting(fakeBackend());
  upsertProfile({ name: "default", instanceUrl: "https://auth.example.com" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setBackendForTesting(null);
  fs.rmSync(configHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.SEAMLESS_REFRESH_TOKEN;
});

describe("createAuthClient", () => {
  it("throws a reauth error when there is no session", async () => {
    await expect(createAuthClient()).rejects.toBeInstanceOf(ReauthRequiredError);
  });
});

describe("transparent refresh", () => {
  it("refreshes on 401, stores the rotated pair, and retries once", async () => {
    await saveTokens(profile, {
      accessToken: "old-access",
      refreshToken: "old-refresh",
    });

    const calls = mockFetch([
      () => new Response(null, { status: 401 }),
      () =>
        json({
          token: "new-access",
          refreshToken: "new-refresh",
          ttl: 900,
          refreshTtl: 86400,
        }),
      () => json({ sub: "user-1" }),
    ]);

    const client = await createAuthClient();
    const res = await client.get<{ sub: string }>("/whoami");

    expect(res.ok).toBe(true);
    expect(res.data?.sub).toBe("user-1");
    expect(calls).toHaveLength(3);

    expect(authHeader(calls[0])).toBe("Bearer old-access");
    expect(calls[1].url).toBe("https://auth.example.com/refresh");
    expect(authHeader(calls[1])).toBe("Bearer old-refresh");
    expect(authHeader(calls[2])).toBe("Bearer new-access");

    const stored = await getTokens(profile);
    expect(stored?.refreshToken).toBe("new-refresh");
    expect(stored?.accessTokenExpiresAt).toBeGreaterThan(Date.now());
  });

  it("re-sends the request body on the retried call", async () => {
    await saveTokens(profile, {
      accessToken: "old-access",
      refreshToken: "old-refresh",
    });

    const calls = mockFetch([
      () => new Response(null, { status: 401 }),
      () => json({ token: "new-access", refreshToken: "new-refresh" }),
      () => json({ ok: true }),
    ]);

    const client = await createAuthClient();
    await client.post("/things", { name: "widget" });

    expect(calls[2].init.body).toBe(JSON.stringify({ name: "widget" }));
    expect(authHeader(calls[2])).toBe("Bearer new-access");
  });

  it("clears the session and demands re-login when refresh is rejected", async () => {
    await saveTokens(profile, {
      accessToken: "old-access",
      refreshToken: "reused-refresh",
    });

    mockFetch([
      () => new Response(null, { status: 401 }),
      () => json({ error: "token reuse detected" }, 401),
    ]);

    const client = await createAuthClient();
    await expect(client.get("/whoami")).rejects.toBeInstanceOf(
      ReauthRequiredError,
    );

    expect(await getTokens(profile)).toBeNull();
  });
});

describe("error and edge responses", () => {
  beforeEach(async () => {
    await saveTokens(profile, {
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("surfaces 429 without attempting a refresh", async () => {
    const calls = mockFetch([() => json({ error: "rate limited" }, 429)]);

    const client = await createAuthClient();
    const res = await client.get("/otp/generate-login-email-otp");

    expect(res.status).toBe(429);
    expect(isRateLimited(res)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("does not crash on an HTML body", async () => {
    mockFetch([
      () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
    ]);

    const client = await createAuthClient();
    const res = await client.get("/whoami");

    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
    expect(res.data).toBeNull();
  });

  it("does not crash on an empty body", async () => {
    mockFetch([() => new Response(null, { status: 204 })]);

    const client = await createAuthClient();
    const res = await client.get("/whoami");

    expect(res.ok).toBe(true);
    expect(res.data).toBeNull();
  });
});

describe("tokensFromAuthResponse", () => {
  it("maps the contract fields and computes expiries", () => {
    const before = Date.now();
    const bundle = tokensFromAuthResponse({
      token: "a",
      refreshToken: "r",
      ttl: 300,
      refreshTtl: 3600,
    });

    expect(bundle?.accessToken).toBe("a");
    expect(bundle?.refreshToken).toBe("r");
    expect(bundle?.accessTokenExpiresAt).toBeGreaterThanOrEqual(before + 300 * 1000);
    expect(bundle?.refreshTokenExpiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });

  it("returns null when required fields are missing", () => {
    expect(tokensFromAuthResponse({ token: "a" })).toBeNull();
    expect(tokensFromAuthResponse(null)).toBeNull();
  });
});
