import type { AuthClient } from "./authClient.js";
import type { Profile } from "./config.js";
import { deleteTokens, KeychainUnavailableError } from "./keychain.js";

export interface Identity {
  sub?: string;
  email?: string;
  roles: string[];
}

export async function fetchIdentity(client: AuthClient): Promise<Identity> {
  const res = await client.get<Record<string, unknown>>("/users/me");
  if (!res.ok) {
    throw new Error(`Could not load your identity (${res.status}).`);
  }

  const user = (res.data?.user ?? {}) as Record<string, unknown>;
  return {
    sub: typeof user.id === "string" ? user.id : undefined,
    email: typeof user.email === "string" ? user.email : undefined,
    roles: Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === "string")
      : [],
  };
}

export async function revokeSession(
  client: AuthClient,
  opts: { all?: boolean } = {},
): Promise<boolean> {
  const path = opts.all ? "/logout/all" : "/logout";
  const res = await client.request(path, { method: "DELETE" });
  return res.ok;
}

export async function clearLocalSession(
  profile: Pick<Profile, "name" | "instanceUrl">,
): Promise<void> {
  try {
    await deleteTokens(profile);
  } catch (err) {
    if (!(err instanceof KeychainUnavailableError)) throw err;
  }
}
