import type { AuthClient } from "./authClient.js";
import { joinUrl } from "./http.js";

// The managed control plane (seamless-portal-api). It only recognizes sessions
// from the portal's own auth instance (getPortalAuthUrl), so these calls take a
// createPortalClient and never the active profile's client: an instance session
// belongs to a different user pool on a different host. Override the host for
// staging or local portal development with SEAMLESS_PORTAL_API_URL.
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

// Split out so a caller can retry a lookup by another reference (a name or infra
// id) without matching on message text.
export class PortalNotFoundError extends PortalError {
  constructor(message: string) {
    super(message);
    this.name = "PortalNotFoundError";
  }
}

// A managed application as the CLI needs it, mapped from the portal's
// serializeApplication payload (documented there as a CLI-facing contract).
//
// `instanceUrl` is where the tenant's auth actually answers; the portal derives
// it from the service plan. `domain` is the stored column it superseded, kept
// because it goes stale when a trial is upgraded and its tenant moves zones, so
// prefer instanceUrl and read both through resolveAppInstanceUrl.
//
// Both are optional: an application that has not finished provisioning has
// neither, and a list command has to be able to show it.
//
// `hasServiceToken` reflects whether a token was ever issued, so init can
// confirm before rotating and invalidating one a deployed app may still be using.
export interface PortalApp {
  id: string;
  name: string;
  instanceUrl?: string;
  domain?: string;
  consoleUrl?: string;
  infraId?: string;
  frontendUrl?: string;
  servicePlan?: string;
  status?: string;
  hostedRegion?: string;
  devMode?: boolean;
  ownerEmails: string[];
  trialExpiresAt?: string;
  createdAt?: string;
  hasServiceToken: boolean;
  // Metadata only. The control plane returns a raw token exclusively at
  // rotation time, so there is never a live secret to show here.
  serviceToken?: { maskedToken?: string; createdAt?: string };
}

// Where this application's auth answers, or undefined while it is still
// provisioning.
export function resolveAppInstanceUrl(app: PortalApp): string | undefined {
  return app.instanceUrl ?? app.domain;
}

function str(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" && value ? value : undefined;
}

function strList(raw: Record<string, unknown>, key: string): string[] {
  const value = raw[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" && value ? [value] : [];
}

function toServiceToken(
  raw: Record<string, unknown>,
): PortalApp["serviceToken"] {
  const meta = raw.serviceTokenMetadata;
  if (!meta || typeof meta !== "object") return undefined;
  const record = meta as Record<string, unknown>;
  return {
    maskedToken: str(record, "maskedToken"),
    createdAt: str(record, "createdAt"),
  };
}

function toApp(raw: Record<string, unknown>): PortalApp | null {
  const id = str(raw, "id");
  if (!id) return null;

  return {
    id,
    name: str(raw, "name") ?? id,
    instanceUrl: str(raw, "instanceUrl"),
    domain: str(raw, "domain"),
    consoleUrl: str(raw, "consoleUrl"),
    infraId: str(raw, "infraId"),
    frontendUrl: str(raw, "frontendUrl"),
    servicePlan: str(raw, "servicePlan"),
    status: str(raw, "status"),
    hostedRegion: str(raw, "hostedRegion"),
    devMode: typeof raw.devMode === "boolean" ? raw.devMode : undefined,
    ownerEmails: strList(raw, "ownerEmail"),
    trialExpiresAt: str(raw, "trialExpiresAt"),
    createdAt: str(raw, "createdAt"),
    hasServiceToken: raw.serviceTokenMetadata != null,
    serviceToken: toServiceToken(raw),
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

export async function getApplication(
  client: AuthClient,
  appId: string,
): Promise<PortalApp> {
  const url = joinUrl(
    getPortalApiUrl(),
    `/applications/${encodeURIComponent(appId)}`,
  );
  const res = await client.get<{ application?: unknown }>(url);

  if (res.status === 401 || res.status === 403) {
    throw unauthorized("read this application");
  }
  if (res.status === 404) {
    throw new PortalNotFoundError(`Managed application "${appId}" was not found.`);
  }
  if (!res.ok) {
    throw new PortalError(`Could not load application "${appId}" (${res.status}).`);
  }

  const raw = res.data?.application;
  const app =
    raw && typeof raw === "object"
      ? toApp(raw as Record<string, unknown>)
      : null;
  if (!app) {
    throw new PortalError(
      `The control plane returned an unexpected response for "${appId}".`,
    );
  }

  return app;
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
    throw new PortalNotFoundError(`Managed application "${appId}" was not found.`);
  }
  if (!res.ok || !res.data?.serviceToken) {
    throw new PortalError(`Could not issue a service token (${res.status}).`);
  }

  return res.data.serviceToken;
}
