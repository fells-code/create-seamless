import { afterEach, describe, expect, it, vi } from "vitest";
import { completeLogin, LoginError } from "./loginFlow.js";

interface Call {
  url: string;
  init: RequestInit;
}

type Responder = () => Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockRouter(routes: Record<string, Responder[]>): Call[] {
  const calls: Call[] = [];
  const queues = new Map<string, Responder[]>(Object.entries(routes));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const key = Object.keys(routes).find((path) => url.endsWith(path));
      if (!key) throw new Error(`No route for ${url}`);
      const queue = queues.get(key)!;
      const responder = queue.length > 1 ? queue.shift()! : queue[0];
      return responder();
    }),
  );

  return calls;
}

function authHeader(call: Call): string | undefined {
  return (call.init.headers as Record<string, string> | undefined)
    ?.Authorization;
}

const INSTANCE = "https://auth.example.com";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("completeLogin", () => {
  it("runs the email OTP flow end to end", async () => {
    const calls = mockRouter({
      "/login": [
        () =>
          json({
            token: "ephemeral-1",
            sub: "user-1",
            identifierType: "email",
            loginMethods: ["email_otp"],
          }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [
        () =>
          json({
            token: "access-1",
            refreshToken: "refresh-1",
            ttl: 900,
            refreshTtl: 86400,
            sub: "user-1",
            email: "dev@example.com",
          }),
      ],
    });

    const result = await completeLogin({
      instanceUrl: INSTANCE,
      identifier: "dev@example.com",
      getCode: async () => "123456",
    });

    expect(result?.tokens.accessToken).toBe("access-1");
    expect(result?.tokens.refreshToken).toBe("refresh-1");
    expect(result?.identity).toEqual({
      sub: "user-1",
      email: "dev@example.com",
      identifierType: "email",
    });

    const verify = calls.find((c) => c.url.endsWith("/otp/verify-login-email-otp"))!;
    expect(authHeader(verify)).toBe("Bearer ephemeral-1");
    expect(verify.init.body).toBe(JSON.stringify({ verificationToken: "123456" }));
  });

  it("passes the channel to getCode so the prompt can validate accordingly", async () => {
    mockRouter({
      "/login": [() => json({ token: "e1", identifierType: "phone" })],
      "/otp/generate-login-phone-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-phone-otp": [() => json({ token: "a", refreshToken: "r" })],
    });

    let seenChannel: string | undefined;
    await completeLogin({
      instanceUrl: INSTANCE,
      identifier: "+15555550100",
      getCode: async ({ channel }) => {
        seenChannel = channel;
        return "123456";
      },
    });

    expect(seenChannel).toBe("phone");
  });

  it("retries a rejected code, then succeeds", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [
        () => json({ error: "Not allowed" }, 401),
        () => json({ token: "a", refreshToken: "r" }),
      ],
    });

    const codes = ["000000", "123456"];
    const attemptsLeft: number[] = [];

    const result = await completeLogin({
      instanceUrl: INSTANCE,
      identifier: "dev@example.com",
      getCode: async () => codes.shift() ?? null,
      notify: (e) => {
        if (e.type === "incorrect") attemptsLeft.push(e.attemptsLeft);
      },
    });

    expect(result?.tokens.accessToken).toBe("a");
    expect(attemptsLeft).toEqual([2]);
  });

  it("gives up after the attempt cap", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ error: "Not allowed" }, 401)],
    });

    let asked = 0;
    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        maxAttempts: 3,
        getCode: async () => {
          asked++;
          return "000000";
        },
      }),
    ).rejects.toBeInstanceOf(LoginError);

    expect(asked).toBe(3);
  });

  it("surfaces the OTP rate limiter on generate", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ error: "rate limited" }, 429)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/10 per 15 minutes/);
  });

  it("re-logins and resends when the ephemeral window expires, without spending an attempt", async () => {
    let clock = 1_000;
    const calls = mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
        () => json({ token: "e2", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ token: "a", refreshToken: "r" })],
    });

    let resentSeen = false;
    const result = await completeLogin({
      instanceUrl: INSTANCE,
      identifier: "dev@example.com",
      now: () => clock,
      getCode: async ({ resent }) => {
        if (!resentSeen) {
          resentSeen = true;
          clock += 6 * 60 * 1000;
          return "123456";
        }
        expect(resent).toBe(true);
        return "654321";
      },
      notify: () => {},
    });

    expect(result?.tokens.accessToken).toBe("a");
    expect(calls.filter((c) => c.url.endsWith("/login"))).toHaveLength(2);
    const verify = calls.find((c) => c.url.endsWith("/verify-login-email-otp"))!;
    expect(authHeader(verify)).toBe("Bearer e2");
  });

  it("rejects an unverified account with a clear message", async () => {
    mockRouter({
      "/login": [() => json({ error: "Login failed. Need to verify." }, 401)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/not verified/i);
  });

  it("rejects when email OTP is not an available login method", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["passkey"] }),
      ],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/cannot use email otp/i);
  });

  it("returns null when the user cancels the code prompt", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
    });

    const result = await completeLogin({
      instanceUrl: INSTANCE,
      identifier: "dev@example.com",
      getCode: async () => null,
    });

    expect(result).toBeNull();
  });

  it("runs the phone OTP flow, defaulting loginMethods when omitted", async () => {
    const calls = mockRouter({
      "/login": [() => json({ token: "e1", identifierType: "phone" })],
      "/otp/generate-login-phone-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-phone-otp": [
        () => json({ token: "a", refreshToken: "r" }),
      ],
    });

    const result = await completeLogin({
      instanceUrl: INSTANCE,
      identifier: "+15555550100",
      getCode: async () => "123456",
    });

    expect(result?.identity.identifierType).toBe("phone");
    expect(calls.some((c) => c.url.endsWith("/otp/generate-login-phone-otp"))).toBe(
      true,
    );
    expect(calls.some((c) => c.url.endsWith("/otp/verify-login-phone-otp"))).toBe(
      true,
    );
  });

  it("wraps a network failure while starting login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      }),
    );

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/Could not reach/);
  });

  it("surfaces the rate limiter when starting login", async () => {
    mockRouter({
      "/login": [() => json({ error: "rate limited" }, 429)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/rate limiting requests/);
  });

  it("rejects an invalid identifier with a 400", async () => {
    mockRouter({
      "/login": [() => json({ error: "Bad identifier" }, 400)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "not-an-identifier",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/not a valid email or phone number/);
  });

  it("rejects an unknown account with a 401 that isn't a verify message", async () => {
    mockRouter({
      "/login": [() => json({ error: "No such account" }, 401)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/No account was found/);
  });

  it("maps other login failures to a generic status error", async () => {
    mockRouter({
      "/login": [() => json({ error: "boom" }, 500)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/Login request failed \(500\)/);
  });

  it("rejects when the instance omits the ephemeral token", async () => {
    mockRouter({
      "/login": [() => json({ identifierType: "email", loginMethods: ["email_otp"] })],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/did not return a login token/);
  });

  it("rejects when OTP login is disabled on the instance", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ error: "disabled" }, 403)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/Email OTP login is disabled/);
  });

  it("includes the API message when sending a code fails", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [
        () => json({ message: "SMTP is down" }, 500),
      ],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/Could not send a code: SMTP is down/);
  });

  it("falls back to a generic message when sending a code fails without detail", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({}, 500)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/Could not send a login code\./);
  });

  it("rejects an unexpected verification response shape", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ status: "ok" })],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/unexpected verification response/);
  });

  it("surfaces the rate limiter when verifying a code", async () => {
    mockRouter({
      "/login": [
        () => json({ token: "e1", identifierType: "email", loginMethods: ["email_otp"] }),
      ],
      "/otp/generate-login-email-otp": [() => json({ message: "sent" })],
      "/otp/verify-login-email-otp": [() => json({ error: "rate limited" }, 429)],
    });

    await expect(
      completeLogin({
        instanceUrl: INSTANCE,
        identifier: "dev@example.com",
        getCode: async () => "123456",
      }),
    ).rejects.toThrow(/Too many attempts/);
  });
});
