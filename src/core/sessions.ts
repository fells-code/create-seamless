import type { AuthClient } from "./authClient.js";

export interface SessionInfo {
  id: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  lastUsedAt?: string;
  expiresAt?: string;
  current: boolean;
}

function str(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value ? value : undefined;
}

function toSessionInfo(raw: unknown): SessionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string") return null;

  return {
    id: record.id,
    deviceName: str(record, "deviceName"),
    ipAddress: str(record, "ipAddress"),
    userAgent: str(record, "userAgent"),
    lastUsedAt: str(record, "lastUsedAt"),
    expiresAt: str(record, "expiresAt"),
    current: record.current === true,
  };
}

export async function listSessions(client: AuthClient): Promise<SessionInfo[]> {
  const res = await client.get<{ sessions?: unknown[] }>("/sessions");
  if (!res.ok) {
    throw new Error(`Could not list sessions (${res.status}).`);
  }

  const raw = Array.isArray(res.data?.sessions) ? res.data.sessions : [];
  return raw
    .map(toSessionInfo)
    .filter((session): session is SessionInfo => session !== null);
}

export interface RevokeResult {
  ok: boolean;
  status: number;
}

export async function revokeSessionById(
  client: AuthClient,
  id: string,
): Promise<RevokeResult> {
  const res = await client.request(`/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return { ok: res.ok, status: res.status };
}

export async function revokeAllSessions(
  client: AuthClient,
): Promise<RevokeResult> {
  const res = await client.request("/sessions", { method: "DELETE" });
  return { ok: res.ok, status: res.status };
}
