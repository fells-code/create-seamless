import type { IdentifierType } from "./config.js";
import { apiRequest, isRateLimited, joinUrl, jsonBody } from "./http.js";
import { tokensFromAuthResponse } from "./authClient.js";
import type { TokenBundle } from "./keychain.js";

export const EPHEMERAL_WINDOW_MS = 5 * 60 * 1000;
export const DEFAULT_MAX_ATTEMPTS = 3;

export type LoginChannel = "email" | "phone";

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

export type LoginEvent =
  | { type: "code_sent"; channel: LoginChannel }
  | { type: "code_resent"; channel: LoginChannel }
  | { type: "verifying" }
  | { type: "incorrect"; attemptsLeft: number };

export interface LoginResult {
  tokens: TokenBundle;
  identity: { sub?: string; email?: string; identifierType: IdentifierType };
  channel: LoginChannel;
}

export interface CompleteLoginOptions {
  instanceUrl: string;
  identifier: string;
  maxAttempts?: number;
  now?: () => number;
  getCode: (ctx: {
    attempt: number;
    resent: boolean;
    channel: LoginChannel;
  }) => Promise<string | null>;
  notify?: (event: LoginEvent) => void;
}

interface StartedLogin {
  ephemeralToken: string;
  loginMethods: string[];
  channel: LoginChannel;
  sub?: string;
  deadline: number;
}

function apiMessage(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return undefined;
}

async function request(
  instanceUrl: string,
  url: string,
  init: RequestInit,
) {
  try {
    return await apiRequest<Record<string, unknown>>(url, init);
  } catch {
    throw new LoginError(
      `Could not reach ${instanceUrl}. Check the instance URL and your connection.`,
    );
  }
}

async function startLogin(
  instanceUrl: string,
  identifier: string,
  now: () => number,
): Promise<StartedLogin> {
  const res = await request(
    instanceUrl,
    joinUrl(instanceUrl, "/login"),
    jsonBody("POST", { identifier }),
  );

  if (isRateLimited(res)) {
    throw new LoginError(
      "The instance is rate limiting requests. Wait a few minutes and try again.",
    );
  }

  if (!res.ok) {
    const message = apiMessage(res.data) ?? "";
    if (res.status === 401 && /verify/i.test(message)) {
      throw new LoginError(
        `The account for ${identifier} is not verified yet. Finish registration, then log in.`,
      );
    }
    if (res.status === 400) {
      throw new LoginError(
        `"${identifier}" is not a valid email or phone number.`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new LoginError(
        `No account was found for ${identifier}, or login is not permitted.`,
      );
    }
    throw new LoginError(`Login request failed (${res.status}).`);
  }

  const data = res.data ?? {};
  const ephemeralToken = typeof data.token === "string" ? data.token : "";
  if (!ephemeralToken) {
    throw new LoginError("The instance did not return a login token.");
  }

  const loginMethods = Array.isArray(data.loginMethods)
    ? data.loginMethods.filter((m): m is string => typeof m === "string")
    : [];
  const channel: LoginChannel =
    data.identifierType === "phone" ? "phone" : "email";
  const sub = typeof data.sub === "string" ? data.sub : undefined;

  return {
    ephemeralToken,
    loginMethods,
    channel,
    sub,
    deadline: now() + EPHEMERAL_WINDOW_MS,
  };
}

async function sendCode(
  instanceUrl: string,
  started: StartedLogin,
): Promise<void> {
  const path =
    started.channel === "email"
      ? "/otp/generate-login-email-otp"
      : "/otp/generate-login-phone-otp";

  const res = await request(instanceUrl, joinUrl(instanceUrl, path), {
    method: "GET",
    headers: { Authorization: `Bearer ${started.ephemeralToken}` },
  });

  if (isRateLimited(res)) {
    throw new LoginError(
      "Too many code requests. The instance limits OTP to 10 per 15 minutes per IP. Wait and try again.",
    );
  }

  if (!res.ok) {
    if (res.status === 403) {
      const label = started.channel === "email" ? "Email" : "Phone";
      throw new LoginError(`${label} OTP login is disabled on this instance.`);
    }
    const message = apiMessage(res.data);
    throw new LoginError(
      message ? `Could not send a code: ${message}` : "Could not send a login code.",
    );
  }

  const refreshed = typeof res.data?.token === "string" ? res.data.token : undefined;
  if (refreshed) started.ephemeralToken = refreshed;
}

async function verifyCode(
  instanceUrl: string,
  started: StartedLogin,
  code: string,
) {
  const path =
    started.channel === "email"
      ? "/otp/verify-login-email-otp"
      : "/otp/verify-login-phone-otp";

  return request(
    instanceUrl,
    joinUrl(instanceUrl, path),
    jsonBody(
      "POST",
      { verificationToken: code },
      { Authorization: `Bearer ${started.ephemeralToken}` },
    ),
  );
}

export async function completeLogin(
  opts: CompleteLoginOptions,
): Promise<LoginResult | null> {
  const now = opts.now ?? (() => Date.now());
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const notify = opts.notify ?? (() => {});

  let started = await startLogin(opts.instanceUrl, opts.identifier, now);
  const channel = started.channel;
  const required = channel === "email" ? "email_otp" : "phone_otp";
  if (started.loginMethods.length > 0 && !started.loginMethods.includes(required)) {
    throw new LoginError(
      `This account cannot use ${required.replace("_", " ")} login. Available methods: ${started.loginMethods.join(", ")}.`,
    );
  }

  await sendCode(opts.instanceUrl, started);
  notify({ type: "code_sent", channel });

  let attempt = 0;
  let resent = false;
  while (attempt < maxAttempts) {
    const code = await opts.getCode({ attempt: attempt + 1, resent, channel });
    resent = false;
    if (code === null) return null;

    if (now() >= started.deadline) {
      started = await startLogin(opts.instanceUrl, opts.identifier, now);
      await sendCode(opts.instanceUrl, started);
      resent = true;
      notify({ type: "code_resent", channel });
      continue;
    }

    notify({ type: "verifying" });
    const res = await verifyCode(opts.instanceUrl, started, code);

    if (res.status === 200 && res.data) {
      const tokens = tokensFromAuthResponse(res.data);
      if (!tokens) {
        throw new LoginError(
          "The instance returned an unexpected verification response.",
        );
      }
      const email = typeof res.data.email === "string" ? res.data.email : undefined;
      const sub = typeof res.data.sub === "string" ? res.data.sub : started.sub;
      return {
        tokens,
        identity: { sub, email, identifierType: channel },
        channel,
      };
    }

    if (isRateLimited(res)) {
      throw new LoginError(
        "Too many attempts. The instance limits OTP to 10 per 15 minutes per IP. Wait and try again.",
      );
    }

    attempt++;
    notify({ type: "incorrect", attemptsLeft: maxAttempts - attempt });
  }

  throw new LoginError("Could not verify a code. Run seamless login to try again.");
}
