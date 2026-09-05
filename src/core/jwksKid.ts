import { apiRequest, joinUrl } from "./http.js";

/**
 * The signing key id a managed instance is actually publishing.
 *
 * Instances pin their kid per tier (`trialkey1`, `paidkey1`), so a scaffold that
 * hardcodes the dev default writes a value the instance never uses. Nothing verifies
 * against it, adapters resolve the key from the token header's `kid` through the
 * remote JWKS, but they also warn on boot when it is left at the dev default, so a
 * managed scaffold otherwise ships an app that complains it is misconfigured.
 *
 * Returns undefined rather than throwing: the kid is cosmetic today, and an instance
 * that is slow to come up should not fail a scaffold over it.
 */
export async function fetchActiveJwksKid(
  instanceUrl: string,
): Promise<string | undefined> {
  let res;
  try {
    res = await apiRequest<{ keys?: unknown }>(
      joinUrl(instanceUrl, "/.well-known/jwks.json"),
      { method: "GET" },
    );
  } catch {
    return undefined;
  }

  if (!res.ok || !Array.isArray(res.data?.keys)) return undefined;

  // Take the first RS256 signing key. The endpoint lists the active key first, and
  // a set carrying a retired key alongside it keeps that one later in the array.
  for (const key of res.data.keys) {
    if (!key || typeof key !== "object") continue;
    const record = key as Record<string, unknown>;
    if (typeof record.kid !== "string" || !record.kid) continue;
    if (record.use !== undefined && record.use !== "sig") continue;
    if (record.alg !== undefined && record.alg !== "RS256") continue;
    return record.kid;
  }

  return undefined;
}
