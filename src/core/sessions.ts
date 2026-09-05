import type { AuthClient } from "./authClient.js";

/**
 * A session as the CLI reads it.
 *
 * `lastUsedAt` and `expiresAt` are optional here while the API declares them
 * required, and that is deliberate rather than drift. Both columns are
 * `allowNull: false` on the instance, so a current one always sends them, but the
 * CLI is versioned separately from the instances it talks to and its serializer
 * omits a field it cannot render. Parsing leniently and reporting what could not be
 * read beats refusing a session over a date this never displays as more than text.
 */
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

export interface SessionList {
  sessions: SessionInfo[];
  /**
   * Rows the instance sent that could not be read, almost always a missing or
   * non-string `id`.
   *
   * Counted rather than discarded quietly. A session this cannot parse is still a
   * session the developer has, and one they cannot revoke without an id, so reporting
   * a shorter list than the instance sent is the wrong way for this command to be
   * wrong.
   */
  unreadable: number;
}

export async function listSessions(client: AuthClient): Promise<SessionList> {
  const res = await client.get<{ sessions?: unknown[] }>("/sessions");
  if (!res.ok) {
    throw new Error(`Could not list sessions (${res.status}).`);
  }

  const raw = Array.isArray(res.data?.sessions) ? res.data.sessions : [];
  const sessions = raw
    .map(toSessionInfo)
    .filter((session): session is SessionInfo => session !== null);

  return { sessions, unreadable: raw.length - sessions.length };
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
