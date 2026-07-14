import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import { PermissionError } from "./systemConfig.js";

export { PermissionError };

export class AdminApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

export type Json = Record<string, unknown>;

function arr(value: unknown): Json[] {
  return Array.isArray(value) ? (value as Json[]) : [];
}

async function call<T>(
  client: AuthClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  let res: ApiResponse<T>;
  if (method === "GET") {
    res = await client.get<T>(path);
  } else {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    res = await client.request<T>(path, init);
  }
  if (res.status === 403) throw new PermissionError();
  return res;
}

// Users

export interface UserList {
  users: Json[];
  total: number;
}

export async function listUsers(client: AuthClient): Promise<UserList> {
  const res = await call<{ users?: unknown; total?: number }>(
    client,
    "GET",
    "/admin/users",
  );
  if (!res.ok) throw new AdminApiError(`Could not list users (${res.status}).`);
  return { users: arr(res.data?.users), total: res.data?.total ?? 0 };
}

export async function deleteUser(client: AuthClient, id: string): Promise<void> {
  const res = await call(client, "DELETE", "/admin/users", { userId: id });
  if (res.status === 404) throw new AdminApiError(`No user found with id ${id}.`);
  if (!res.ok) throw new AdminApiError(`Could not delete user (${res.status}).`);
}

export interface UserDetail {
  user: Json | null;
  sessions: Json[];
  credentials: Json[];
  events: Json[];
}

export async function getUserDetail(
  client: AuthClient,
  id: string,
): Promise<UserDetail> {
  const res = await call<Json>(
    client,
    "GET",
    `/admin/users/${encodeURIComponent(id)}`,
  );
  if (res.status === 404) throw new AdminApiError(`No user found with id ${id}.`);
  if (!res.ok) throw new AdminApiError(`Could not load user (${res.status}).`);
  const data = res.data ?? {};
  return {
    user: (data.user as Json) ?? null,
    sessions: arr(data.sessions),
    credentials: arr(data.credentials),
    events: arr(data.events),
  };
}

export interface DeviceReplacementOptions {
  revokeSessions: boolean;
  removePasskeys: boolean;
  disableTotp: boolean;
}

export async function prepareDeviceReplacement(
  client: AuthClient,
  id: string,
  opts: DeviceReplacementOptions,
): Promise<Json> {
  const res = await client.request<Json>(
    `/admin/users/${encodeURIComponent(id)}/recovery/device-replacement`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
  if (res.status === 404) throw new AdminApiError(`No user found with id ${id}.`);
  if (res.status === 401 || res.status === 403) {
    throw new PermissionError(
      "Admin-assisted device replacement requires an elevated step-up admin session, which the CLI cannot establish yet. Use the dashboard for this action.",
    );
  }
  if (!res.ok) {
    throw new AdminApiError(
      `Could not prepare device replacement (${res.status}).`,
    );
  }
  return res.data ?? {};
}

// Organizations

export interface OrgList {
  organizations: Json[];
  total: number;
}

export async function listOrgs(client: AuthClient): Promise<OrgList> {
  const res = await call<{ organizations?: unknown; total?: number }>(
    client,
    "GET",
    "/admin/organizations",
  );
  if (!res.ok) throw new AdminApiError(`Could not list organizations (${res.status}).`);
  return {
    organizations: arr(res.data?.organizations),
    total: res.data?.total ?? 0,
  };
}

function orgEnvelope(res: ApiResponse<{ organization?: Json }>): Json {
  if (!res.ok || !res.data?.organization) {
    throw new AdminApiError(`Request failed (${res.status}).`);
  }
  return res.data.organization;
}

export async function createOrg(
  client: AuthClient,
  body: Json,
): Promise<Json> {
  const res = await call<{ organization?: Json }>(
    client,
    "POST",
    "/admin/organizations",
    body,
  );
  return orgEnvelope(res);
}

export async function getOrg(client: AuthClient, id: string): Promise<Json> {
  const res = await call<{ organization?: Json }>(
    client,
    "GET",
    `/admin/organizations/${encodeURIComponent(id)}`,
  );
  if (res.status === 404) {
    throw new AdminApiError(`No organization found with id ${id}.`);
  }
  return orgEnvelope(res);
}

export async function updateOrg(
  client: AuthClient,
  id: string,
  body: Json,
): Promise<Json> {
  const res = await call<{ organization?: Json }>(
    client,
    "PATCH",
    `/admin/organizations/${encodeURIComponent(id)}`,
    body,
  );
  if (res.status === 404) {
    throw new AdminApiError(`No organization found with id ${id}.`);
  }
  return orgEnvelope(res);
}

export interface MemberList {
  members: Json[];
  total: number;
}

export async function listMembers(
  client: AuthClient,
  orgId: string,
): Promise<MemberList> {
  const res = await call<{ members?: unknown; total?: number }>(
    client,
    "GET",
    `/admin/organizations/${encodeURIComponent(orgId)}/members`,
  );
  if (res.status === 404) {
    throw new AdminApiError(`No organization found with id ${orgId}.`);
  }
  if (!res.ok) throw new AdminApiError(`Could not list members (${res.status}).`);
  return { members: arr(res.data?.members), total: res.data?.total ?? 0 };
}

function membershipEnvelope(res: ApiResponse<{ membership?: Json }>): Json {
  if (!res.ok || !res.data?.membership) {
    throw new AdminApiError(`Request failed (${res.status}).`);
  }
  return res.data.membership;
}

export async function addMember(
  client: AuthClient,
  orgId: string,
  body: Json,
): Promise<Json> {
  const res = await call<{ membership?: Json }>(
    client,
    "POST",
    `/admin/organizations/${encodeURIComponent(orgId)}/members`,
    body,
  );
  if (res.status === 404) {
    throw new AdminApiError(`No organization found with id ${orgId}.`);
  }
  return membershipEnvelope(res);
}

export async function updateMember(
  client: AuthClient,
  orgId: string,
  userId: string,
  body: Json,
): Promise<Json> {
  const res = await call<{ membership?: Json }>(
    client,
    "PATCH",
    `/admin/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
    body,
  );
  if (res.status === 404) {
    throw new AdminApiError(`No such organization or member.`);
  }
  return membershipEnvelope(res);
}

export async function removeMember(
  client: AuthClient,
  orgId: string,
  userId: string,
): Promise<void> {
  const res = await call(
    client,
    "DELETE",
    `/admin/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
  );
  if (res.status === 404) {
    throw new AdminApiError(`No such organization or member.`);
  }
  if (!res.ok) throw new AdminApiError(`Could not remove member (${res.status}).`);
}
