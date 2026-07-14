import { getActiveProfile, type Profile } from "./config.js";
import {
  deleteTokens,
  getTokens,
  KeychainUnavailableError,
  saveTokens,
  type TokenBundle,
} from "./keychain.js";
import { apiRequest, joinUrl, type ApiResponse } from "./http.js";

export class ReauthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReauthRequiredError";
  }
}

export interface AuthClient {
  profile: Profile;
  request<T = unknown>(path: string, init?: RequestInit): Promise<ApiResponse<T>>;
  get<T = unknown>(path: string, init?: RequestInit): Promise<ApiResponse<T>>;
  post<T = unknown>(
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<ApiResponse<T>>;
}

export function tokensFromAuthResponse(
  data: Record<string, unknown> | null,
): TokenBundle | null {
  if (!data) return null;

  const accessToken = typeof data.token === "string" ? data.token : undefined;
  const refreshToken =
    typeof data.refreshToken === "string" ? data.refreshToken : undefined;
  if (!accessToken || !refreshToken) return null;

  const now = Date.now();
  const ttl = typeof data.ttl === "number" ? data.ttl : undefined;
  const refreshTtl =
    typeof data.refreshTtl === "number" ? data.refreshTtl : undefined;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: ttl !== undefined ? now + ttl * 1000 : undefined,
    refreshTokenExpiresAt:
      refreshTtl !== undefined ? now + refreshTtl * 1000 : undefined,
  };
}

export async function createAuthClient(
  opts: { profileFlag?: string } = {},
): Promise<AuthClient> {
  const profile = getActiveProfile(opts);
  if (!profile) {
    throw new ReauthRequiredError(
      "No active profile is configured. Add one with: seamless profile add <name> --instance-url <url>, then run seamless login.",
    );
  }

  let tokens = await getTokens(profile);
  if (!tokens || !tokens.refreshToken) {
    throw new ReauthRequiredError(
      `No session for profile "${profile.name}". Run: seamless login.`,
    );
  }
  const session = tokens;

  const persist = async (next: TokenBundle): Promise<void> => {
    session.accessToken = next.accessToken;
    session.refreshToken = next.refreshToken;
    session.accessTokenExpiresAt = next.accessTokenExpiresAt;
    session.refreshTokenExpiresAt = next.refreshTokenExpiresAt;
    try {
      await saveTokens(profile, next);
    } catch (err) {
      if (!(err instanceof KeychainUnavailableError)) throw err;
    }
  };

  const clearSession = async (): Promise<void> => {
    try {
      await deleteTokens(profile);
    } catch (err) {
      if (!(err instanceof KeychainUnavailableError)) throw err;
    }
  };

  const refresh = async (): Promise<void> => {
    const res = await apiRequest<Record<string, unknown>>(
      joinUrl(profile.instanceUrl, "/refresh"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.refreshToken}` },
      },
    );

    if (!res.ok) {
      await clearSession();
      throw new ReauthRequiredError(
        `Your session for "${profile.name}" has expired or was revoked. Run: seamless login.`,
      );
    }

    const next = tokensFromAuthResponse(res.data);
    if (!next) {
      await clearSession();
      throw new ReauthRequiredError(
        `Received an unexpected refresh response from ${profile.instanceUrl}. Run: seamless login.`,
      );
    }

    await persist(next);
  };

  const authedFetch = async <T>(
    path: string,
    init: RequestInit = {},
  ): Promise<ApiResponse<T>> => {
    const build = (): RequestInit => ({
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const url = joinUrl(profile.instanceUrl, path);
    let res = await apiRequest<T>(url, build());

    if (res.status === 401 && session.refreshToken) {
      await refresh();
      res = await apiRequest<T>(url, build());
    }

    return res;
  };

  return {
    profile,
    request: authedFetch,
    get: (path, init = {}) => authedFetch(path, { ...init, method: "GET" }),
    post: (path, body, init = {}) => {
      const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
      };
      let bodyInit = init.body;
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        bodyInit = JSON.stringify(body);
      }
      return authedFetch(path, {
        ...init,
        method: "POST",
        headers,
        body: bodyInit,
      });
    },
  };
}
