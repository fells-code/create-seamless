import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setActiveProfile, upsertProfile } from "./config.js";
import { createAuthClient } from "./authClient.js";
import { completeLogin } from "./loginFlow.js";
import {
  getTokens,
  saveTokens,
  setBackendForTesting,
  type KeychainBackend,
} from "./keychain.js";

// End-to-end auth flow against a running Seamless Auth instance. Skipped unless
// SEAMLESS_E2E_URL points at an instance that has email_otp as a login method and
// runs outside production (so the external-delivery seam returns OTP codes). Bring
// one up with `seamless verify --api-only --keep-up`, or run the auth-api locally,
// then: SEAMLESS_E2E_URL=http://localhost:5312 npm test.
//
// The per-IP OTP limiter is 10 requests / 15 minutes, and each run spends a few
// requests, so allow a fresh window between runs. The rate-limit test deliberately
// exhausts the limiter, so it is gated behind a second flag (SEAMLESS_E2E_RATE_LIMIT).
const BASE = process.env.SEAMLESS_E2E_URL;
const EXTERNAL = { "x-seamless-auth-delivery-mode": "external" };

function memoryBackend(): KeychainBackend {
  const store = new Map<string, string>();
  return {
    get: (account) => store.get(account) ?? null,
    set: (account, secret) => {
      store.set(account, secret);
    },
    delete: (account) => store.delete(account),
  };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`non-JSON response (${res.status}): ${text.slice(0, 80)}`);
  }
}

function deliveryCode(body: Record<string, unknown>): string | undefined {
  return (body.delivery as { token?: string } | undefined)?.token;
}

async function registerAndVerify(email: string): Promise<void> {
  const reg = await fetch(`${BASE}/registration/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...EXTERNAL },
    body: JSON.stringify({ email }),
  });
  const regBody = await readJson(reg);
  if (!reg.ok || typeof regBody.token !== "string") {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(regBody)}`);
  }
  const ephemeral = regBody.token;

  const gen = await fetch(`${BASE}/otp/generate-email-otp`, {
    headers: { Authorization: `Bearer ${ephemeral}`, ...EXTERNAL },
  });
  const code = deliveryCode(await readJson(gen));
  if (!gen.ok || !code) {
    throw new Error(`registration generate failed: ${gen.status}`);
  }

  const verify = await fetch(`${BASE}/otp/verify-email-otp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ephemeral}`, "Content-Type": "application/json" },
    body: JSON.stringify({ verificationToken: code }),
  });
  if (!verify.ok) {
    throw new Error(`registration verify failed: ${verify.status} ${await verify.text()}`);
  }
}

async function loginEphemeral(email: string): Promise<string> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email }),
  });
  const body = await readJson(res);
  if (!res.ok || typeof body.token !== "string") {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.token;
}

// Wrap fetch so the CLI's own generate-login-email-otp call asks for external
// delivery and we capture the exact code it produced. This makes the login a
// single generate (no racing second call) and reads the same code the CLI sent.
const realFetch = globalThis.fetch;
let capturedCode: string | undefined;

function installCliCodeCapture(): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/otp/generate-login-email-otp")) {
      const withDelivery = {
        ...init,
        headers: { ...(init.headers as Record<string, string>), ...EXTERNAL },
      };
      const res = await realFetch(url, withDelivery);
      try {
        const code = deliveryCode(await res.clone().json());
        if (code) capturedCode = code;
      } catch {
        // leave capturedCode unset; getCode will surface a clear error
      }
      return res;
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = realFetch;
}

describe.skipIf(!BASE)("auth flow (e2e)", () => {
  const email = `cli-e2e-${randomUUID()}@example.com`;
  const profile = { name: "e2e", instanceUrl: BASE as string };
  let configHome: string;

  // Register, then log in through the CLI's real login flow, once for the suite.
  beforeAll(async () => {
    configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-e2e-"));
    process.env.XDG_CONFIG_HOME = configHome;
    delete process.env.SEAMLESS_REFRESH_TOKEN;
    setBackendForTesting(memoryBackend());
    upsertProfile(profile);
    setActiveProfile("e2e");

    await registerAndVerify(email);

    installCliCodeCapture();
    try {
      const result = await completeLogin({
        instanceUrl: BASE as string,
        identifier: email,
        getCode: async () => {
          if (!capturedCode) throw new Error("no OTP code was captured");
          return capturedCode;
        },
      });
      if (!result) throw new Error("login returned no session");
      await saveTokens(profile, result.tokens);
      upsertProfile({ ...profile, sub: result.identity.sub, email, identifierType: "email" });
    } finally {
      restoreFetch();
    }
  }, 60_000);

  afterAll(() => {
    restoreFetch();
    setBackendForTesting(null);
    if (configHome) fs.rmSync(configHome, { recursive: true, force: true });
    delete process.env.XDG_CONFIG_HOME;
  });

  it("holds a session that authenticates against the instance", async () => {
    const client = await createAuthClient({});
    const me = await client.get<{ user?: { email?: string } }>("/users/me");
    expect(me.ok).toBe(true);
    expect(me.data?.user?.email).toBe(email.toLowerCase());
  }, 30_000);

  it("refreshes transparently when the access token is stale", async () => {
    const before = await getTokens(profile);
    await saveTokens(profile, { ...before!, accessToken: "stale.invalid.token" });

    const client = await createAuthClient({});
    const me = await client.get("/users/me");
    expect(me.ok).toBe(true);

    const after = await getTokens(profile);
    expect(after?.refreshToken).not.toBe(before?.refreshToken);
  }, 30_000);

  it("rejects a reused refresh token", async () => {
    const tokens = await getTokens(profile);
    const reused = tokens!.refreshToken;

    const first = await fetch(`${BASE}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${reused}` },
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${BASE}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${reused}` },
    });
    expect(second.status).toBe(401);
  }, 30_000);

  // Deliberately exhausts the per-IP OTP limiter (10 / 15 min), so it is gated
  // behind a second flag to keep it out of routine e2e runs.
  it.skipIf(!process.env.SEAMLESS_E2E_RATE_LIMIT)(
    "surfaces the OTP rate limiter as a 429",
    async () => {
      const ephemeral = await loginEphemeral(email);
      let sawRateLimit = false;
      for (let i = 0; i < 15; i++) {
        const res = await fetch(`${BASE}/otp/generate-login-email-otp`, {
          headers: { Authorization: `Bearer ${ephemeral}`, ...EXTERNAL },
        });
        if (res.status === 429) {
          sawRateLimit = true;
          break;
        }
      }
      expect(sawRateLimit).toBe(true);

      await expect(
        completeLogin({
          instanceUrl: BASE as string,
          identifier: email,
          getCode: async () => "000000",
        }),
      ).rejects.toThrow(/10 per 15 minutes/i);
    },
    60_000,
  );
});
