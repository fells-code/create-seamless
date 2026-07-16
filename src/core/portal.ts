import type { AuthClient } from "./authClient.js";
import { joinUrl } from "./http.js";

// The managed control plane (seamless-portal-api). It is fronted by the same
// Seamless Auth server a developer logs into, so the CLI reuses the active
// profile's keychain session (Bearer) to call it. Override the host for staging
// or local portal development with SEAMLESS_PORTAL_API_URL.
export const DEFAULT_PORTAL_API_URL = "https://api.seamlessauth.com";

export function getPortalApiUrl(): string {
  const override = process.env.SEAMLESS_PORTAL_API_URL?.trim();
  const base = override || DEFAULT_PORTAL_API_URL;
  return base.replace(/\/+$/, "");
}

export class PortalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalError";
  }
}

// A managed application as the CLI needs it. `domain` is the application's own
// managed auth instance URL (https://<infraId>.seamlessauth.com), which the
// scaffold points its AUTH_SERVER_URL at. `hasServiceToken` reflects whether a
// service token was ever issued, so init can confirm before rotating and
// invalidating one that a deployed app may still be using.
export interface PortalApp {
  id: string;
  name: string;
  domain: string;
  infraId?: string;
  frontendUrl?: string;
  servicePlan?: string;
  status?: string;
  hasServiceToken: boolean;
}

function str(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" && value ? value : undefined;
}

function toApp(raw: Record<string, unknown>): PortalApp | null {
  const id = str(raw, "id");
  const domain = str(raw, "domain");
  if (!id || !domain) return null;

  return {
    id,
    name: str(raw, "name") ?? id,
    domain,
    infraId: str(raw, "infraId"),
    frontendUrl: str(raw, "frontendUrl"),
    servicePlan: str(raw, "servicePlan"),
    status: str(raw, "status"),
    hasServiceToken: raw.serviceTokenMetadata != null,
  };
}

function unauthorized(action: string): PortalError {
  return new PortalError(
    `Your managed session is not authorized to ${action}. Run: seamless login.`,
  );
}

export async function listApplications(client: AuthClient): Promise<PortalApp[]> {
  const url = joinUrl(getPortalApiUrl(), "/applications");
  const res = await client.get<{ applications?: unknown }>(url);

  if (res.status === 401 || res.status === 403) {
    throw unauthorized("read your applications");
  }
  if (!res.ok) {
    throw new PortalError(`Could not list managed applications (${res.status}).`);
  }

  const list = Array.isArray(res.data?.applications) ? res.data.applications : [];
  return list
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map(toApp)
    .filter((a): a is PortalApp => a !== null);
}

// Issues (rotates) the application's service token. The control plane only ever
// returns a raw token at rotation time (it is stored write-once), so this is the
// real credential flow: the token the auth instance already recognizes for this
// app, not a locally minted secret.
export async function rotateServiceToken(
  client: AuthClient,
  appId: string,
): Promise<string> {
  const url = joinUrl(
    getPortalApiUrl(),
    `/applications/${encodeURIComponent(appId)}/rotateServiceToken`,
  );
  const res = await client.post<{ serviceToken?: string }>(url);

  if (res.status === 401 || res.status === 403) {
    throw unauthorized("issue a service token");
  }
  if (res.status === 404) {
    throw new PortalError(`Managed application "${appId}" was not found.`);
  }
  if (!res.ok || !res.data?.serviceToken) {
    throw new PortalError(`Could not issue a service token (${res.status}).`);
  }

  return res.data.serviceToken;
}
