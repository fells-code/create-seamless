import type { AuthClient } from "./authClient.js";
import { scrubTokens } from "./redact.js";

export type SystemConfig = Record<string, unknown>;

// Mirrors the instance's patch schema, which is strict: a key missing here is one
// `config apply` silently drops and `config set` refuses, so the two lists have to
// stay in step.
export const WRITABLE_KEYS = [
  "app_name",
  "default_roles",
  "available_roles",
  "login_methods",
  "passkey_login_fallback_enabled",
  "oauth_providers",
  "lockout_policy",
  "authenticator_policy",
  "access_token_ttl",
  "session_idle_ttl",
  "refresh_token_ttl",
  "max_concurrent_sessions",
  "rate_limit",
  "delay_after",
  "rpid",
  "origins",
  "magic_link_redirect_uris",
] as const;

const WRITABLE = new Set<string>(WRITABLE_KEYS);

export class PermissionError extends Error {
  constructor(
    message = "You do not have permission for this action. It requires an admin role on the instance.",
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

export class ConfigApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigApiError";
  }
}

export async function getSystemConfig(
  client: AuthClient,
): Promise<SystemConfig> {
  const res = await client.get<SystemConfig>("/system-config/admin");
  if (res.status === 403) throw new PermissionError();
  if (!res.ok || !res.data) {
    throw new ConfigApiError(`Could not read system config (${res.status}).`);
  }
  return res.data;
}

export async function getRoles(client: AuthClient): Promise<string[]> {
  const res = await client.get<{ roles?: unknown[] }>("/system-config/roles");
  if (res.status === 403) throw new PermissionError();
  if (!res.ok) {
    throw new ConfigApiError(`Could not read roles (${res.status}).`);
  }
  return Array.isArray(res.data?.roles)
    ? res.data.roles.filter((role): role is string => typeof role === "string")
    : [];
}

export interface PatchResult {
  success: boolean;
  updatedKeys: string[];
}

export async function patchSystemConfig(
  client: AuthClient,
  patch: SystemConfig,
): Promise<PatchResult> {
  const res = await client.request<{
    success?: boolean;
    updatedKeys?: string[];
    error?: string;
    details?: unknown;
  }>("/system-config/admin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (res.status === 403) throw new PermissionError();
  if (res.status === 400) {
    const reason = res.data?.error ?? "Invalid configuration";
    const details = res.data?.details
      ? ` ${JSON.stringify(scrubTokens(res.data.details))}`
      : "";
    throw new ConfigApiError(`${reason}.${details}`);
  }
  if (!res.ok) {
    throw new ConfigApiError(`Could not update system config (${res.status}).`);
  }

  return {
    success: res.data?.success ?? true,
    updatedKeys: Array.isArray(res.data?.updatedKeys)
      ? res.data.updatedKeys
      : [],
  };
}

export type OAuthProvider = Record<string, unknown>;

const OAUTH_PROVIDERS_PATH = "/system-config/oauth-providers";

function providerMutationError(
  res: { status: number; data: { error?: string; details?: unknown } | null },
  action: string,
  id?: unknown,
): never {
  if (res.status === 403) throw new PermissionError();

  const label = id ? ` "${String(id)}"` : "";
  if (res.status === 404) {
    throw new ConfigApiError(`OAuth provider${label} not found.`);
  }
  if (res.status === 409) {
    throw new ConfigApiError(
      res.data?.error ?? `OAuth provider${label} already exists.`,
    );
  }
  if (res.status === 400) {
    const reason = res.data?.error ?? "Invalid OAuth provider";
    const details = res.data?.details
      ? ` ${JSON.stringify(scrubTokens(res.data.details))}`
      : "";
    throw new ConfigApiError(`${reason}.${details}`);
  }
  throw new ConfigApiError(`Could not ${action} OAuth provider (${res.status}).`);
}

export async function listOAuthProviders(
  client: AuthClient,
): Promise<OAuthProvider[]> {
  const res = await client.get<{ providers?: unknown }>(OAUTH_PROVIDERS_PATH);
  if (res.status === 403) throw new PermissionError();
  if (!res.ok) {
    throw new ConfigApiError(`Could not list OAuth providers (${res.status}).`);
  }
  return Array.isArray(res.data?.providers)
    ? (res.data.providers as OAuthProvider[])
    : [];
}

export async function createOAuthProvider(
  client: AuthClient,
  provider: OAuthProvider,
): Promise<OAuthProvider> {
  const res = await client.request<{
    provider?: OAuthProvider;
    error?: string;
    details?: unknown;
  }>(OAUTH_PROVIDERS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(provider),
  });

  if (res.ok) return res.data?.provider ?? provider;
  throw providerMutationError(res, "add", provider.id);
}

export async function updateOAuthProvider(
  client: AuthClient,
  id: string,
  updates: OAuthProvider,
): Promise<OAuthProvider> {
  const res = await client.request<{
    provider?: OAuthProvider;
    error?: string;
    details?: unknown;
  }>(`${OAUTH_PROVIDERS_PATH}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (res.ok) return res.data?.provider ?? updates;
  throw providerMutationError(res, "update", id);
}

export async function deleteOAuthProvider(
  client: AuthClient,
  id: string,
): Promise<void> {
  const res = await client.request<{ error?: string; details?: unknown }>(
    `${OAUTH_PROVIDERS_PATH}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );

  if (res.ok) return;
  throw providerMutationError(res, "remove", id);
}

// The writable keys the instance types as a plain string. Their values are never
// JSON-parsed, so `config set app_name 123` sends the string "123" rather than the
// number 123, and `config set rpid true` sends "true". Everything else (arrays,
// objects, numbers, booleans) is parsed, falling back to the raw string when the
// value is not valid JSON, which is what makes `access_token_ttl 15m` work.
const STRING_KEYS = new Set<string>([
  "app_name",
  "access_token_ttl",
  "session_idle_ttl",
  "refresh_token_ttl",
  "rpid",
]);

export function isStringKey(key: string): boolean {
  return STRING_KEYS.has(key);
}

export function parseValue(raw: string, key?: string): unknown {
  const trimmed = raw.trim();
  if (key !== undefined && STRING_KEYS.has(key)) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export function isWritableKey(key: string): boolean {
  return WRITABLE.has(key);
}

export function filterWritable(config: SystemConfig): {
  patch: SystemConfig;
  dropped: string[];
} {
  const patch: SystemConfig = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (WRITABLE.has(key)) patch[key] = value;
    else dropped.push(key);
  }
  return { patch, dropped };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    );
  }

  return false;
}

export interface ConfigChange {
  key: string;
  from: unknown;
  to: unknown;
}

export function diffConfig(
  local: SystemConfig,
  remote: SystemConfig,
): ConfigChange[] {
  const changes: ConfigChange[] = [];
  for (const [key, to] of Object.entries(local)) {
    if (!deepEqual(remote[key], to)) {
      changes.push({ key, from: remote[key], to });
    }
  }
  return changes;
}
