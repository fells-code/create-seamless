import { describe, expect, it } from "vitest";
import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import {
  addMember,
  AdminApiError,
  createOrg,
  deleteUser,
  getOrg,
  getUserDetail,
  listMembers,
  listOrgs,
  listUsers,
  PermissionError,
  prepareDeviceReplacement,
  removeMember,
  updateMember,
  updateOrg,
} from "./admin.js";

function response<T>(status: number, data: T | null): ApiResponse<T> {
  return { ok: status >= 200 && status < 300, status, data, headers: new Headers() };
}

interface Recorded {
  method: string;
  path: string;
  body?: unknown;
}

function fakeClient(
  handler: (rec: Recorded) => ApiResponse<unknown>,
): { client: AuthClient; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const record = (method: string, path: string, init?: RequestInit) => {
    const rec: Recorded = {
      method,
      path,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(rec);
    return handler(rec);
  };
  return {
    calls,
    client: {
      profile: { name: "default", instanceUrl: "https://auth.example.com" },
      get: async (path) => record("GET", path) as never,
      post: async (path) => record("POST", path) as never,
      request: async (path, init) =>
        record((init?.method ?? "GET").toUpperCase(), path, init) as never,
    },
  };
}

describe("users", () => {
  it("lists users", async () => {
    const { client } = fakeClient(({ method, path }) => {
      expect(`${method} ${path}`).toBe("GET /admin/users");
      return response(200, { users: [{ id: "u1" }], total: 1 });
    });
    expect(await listUsers(client)).toEqual({ users: [{ id: "u1" }], total: 1 });
  });

  it("deletes a user via the body userId", async () => {
    const { client, calls } = fakeClient(() => response(200, { message: "ok" }));
    await deleteUser(client, "u1");
    expect(calls[0]).toEqual({
      method: "DELETE",
      path: "/admin/users",
      body: { userId: "u1" },
    });
  });

  it("maps a 404 delete to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "User not found." }));
    await expect(deleteUser(client, "missing")).rejects.toThrow(/No user found/);
  });

  it("reads credentials from the user detail endpoint", async () => {
    const { client } = fakeClient(({ path }) => {
      expect(path).toBe("/admin/users/u1");
      return response(200, {
        user: { id: "u1" },
        credentials: [{ id: "c1" }, { id: "c2" }],
        sessions: [],
        events: [],
      });
    });
    const detail = await getUserDetail(client, "u1");
    expect(detail.credentials).toHaveLength(2);
  });

  it("explains the step-up requirement for device replacement", async () => {
    const { client, calls } = fakeClient(() => response(401, { error: "step up" }));
    await expect(
      prepareDeviceReplacement(client, "u1", {
        revokeSessions: true,
        removePasskeys: true,
        disableTotp: true,
      }),
    ).rejects.toThrow(/step-up/i);
    expect(calls[0].path).toBe("/admin/users/u1/recovery/device-replacement");
    expect(calls[0].body).toEqual({
      revokeSessions: true,
      removePasskeys: true,
      disableTotp: true,
    });
  });

  it("maps 403 to a PermissionError", async () => {
    const { client } = fakeClient(() => response(403, { error: "Forbidden" }));
    await expect(listUsers(client)).rejects.toBeInstanceOf(PermissionError);
  });

  it("returns the recovery payload on a successful device replacement", async () => {
    const { client } = fakeClient(() => response(200, { recoveryUrl: "https://x" }));
    const result = await prepareDeviceReplacement(client, "u1", {
      revokeSessions: true,
      removePasskeys: false,
      disableTotp: false,
    });
    expect(result).toEqual({ recoveryUrl: "https://x" });
  });

  it("maps a generic failure on device replacement to an AdminApiError", async () => {
    const { client } = fakeClient(() => response(500, { error: "boom" }));
    await expect(
      prepareDeviceReplacement(client, "u1", {
        revokeSessions: false,
        removePasskeys: false,
        disableTotp: false,
      }),
    ).rejects.toThrow(/Could not prepare device replacement/);
  });
});

describe("organizations", () => {
  it("lists organizations", async () => {
    const { client } = fakeClient(({ path }) => {
      expect(path).toBe("/admin/organizations");
      return response(200, { organizations: [{ id: "o1" }], total: 1 });
    });
    expect(await listOrgs(client)).toEqual({
      organizations: [{ id: "o1" }],
      total: 1,
    });
  });

  it("creates an org and unwraps the envelope", async () => {
    const { client, calls } = fakeClient(() =>
      response(201, { organization: { id: "o1", name: "Acme" } }),
    );
    const org = await createOrg(client, { name: "Acme" });
    expect(org).toEqual({ id: "o1", name: "Acme" });
    expect(calls[0]).toEqual({
      method: "POST",
      path: "/admin/organizations",
      body: { name: "Acme" },
    });
  });

  it("updates an org", async () => {
    const { client, calls } = fakeClient(() =>
      response(200, { organization: { id: "o1", name: "New" } }),
    );
    await updateOrg(client, "o1", { name: "New" });
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      path: "/admin/organizations/o1",
      body: { name: "New" },
    });
  });

  it("lists members and adds one by email", async () => {
    const { client } = fakeClient(({ method, path }) => {
      if (method === "GET") {
        expect(path).toBe("/admin/organizations/o1/members");
        return response(200, { members: [{ userId: "u1" }], total: 1 });
      }
      return response(201, { membership: { userId: "u2", roles: ["member"] } });
    });

    expect((await listMembers(client, "o1")).total).toBe(1);
    const membership = await addMember(client, "o1", { email: "x@example.com" });
    expect(membership).toEqual({ userId: "u2", roles: ["member"] });
  });

  it("updates and removes a member with encoded paths", async () => {
    const { client, calls } = fakeClient(({ method }) =>
      method === "PATCH"
        ? response(200, { membership: { userId: "u1", roles: ["admin"] } })
        : response(200, { message: "ok" }),
    );

    await updateMember(client, "o1", "u1", { roles: ["admin"] });
    await removeMember(client, "o1", "u1");
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "PATCH /admin/organizations/o1/members/u1",
      "DELETE /admin/organizations/o1/members/u1",
    ]);
  });

  it("maps a 404 org to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(updateOrg(client, "missing", { name: "x" })).rejects.toBeInstanceOf(
      AdminApiError,
    );
  });

  it("gets a single org and unwraps the envelope", async () => {
    const { client } = fakeClient(({ path }) => {
      expect(path).toBe("/admin/organizations/o1");
      return response(200, { organization: { id: "o1", name: "Acme" } });
    });
    expect(await getOrg(client, "o1")).toEqual({ id: "o1", name: "Acme" });
  });

  it("maps a 404 get org to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(getOrg(client, "missing")).rejects.toThrow(/No organization found/);
  });

  it("throws from the org envelope when the response is not ok", async () => {
    const { client } = fakeClient(() => response(500, { error: "boom" }));
    await expect(createOrg(client, { name: "Acme" })).rejects.toBeInstanceOf(
      AdminApiError,
    );
  });

  it("reports the server's reason for a duplicate org rather than the bare status", async () => {
    const { client } = fakeClient(() =>
      response(409, { error: "Organization slug already in use" }),
    );
    await expect(createOrg(client, { name: "Acme", slug: "acme" })).rejects.toThrow(
      "Organization slug already in use (409).",
    );
  });

  it("includes validation details the server sends back", async () => {
    const { client } = fakeClient(() =>
      response(400, { error: "Invalid payload", details: { slug: "required" } }),
    );
    await expect(createOrg(client, { name: "Acme" })).rejects.toThrow(
      /Invalid payload \(400\)\. \{"slug":"required"\}/,
    );
  });

  it("redacts a secret in the details it echoes", async () => {
    const { client } = fakeClient(() =>
      response(400, { error: "Invalid", details: { body: { password: "hunter2" } } }),
    );
    const err = await createOrg(client, { name: "Acme" }).catch((e: Error) => e);
    expect((err as Error).message).toContain('"password":"[redacted]"');
    expect((err as Error).message).not.toContain("hunter2");
  });

  it("names the failure when the server answers ok with no organization", async () => {
    const { client } = fakeClient(() => response(200, {}));
    await expect(createOrg(client, { name: "Acme" })).rejects.toThrow(
      /returned no organization \(200\)/,
    );
  });

  it("maps a 404 on listMembers to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(listMembers(client, "missing")).rejects.toThrow(
      /No organization found/,
    );
  });

  it("throws from the membership envelope when the response is not ok", async () => {
    const { client } = fakeClient(() => response(500, { error: "boom" }));
    await expect(addMember(client, "o1", { email: "x@example.com" })).rejects.toBeInstanceOf(
      AdminApiError,
    );
  });

  it("reports the server's reason for an already-present member", async () => {
    const { client } = fakeClient(() =>
      response(409, { error: "User is already an organization member" }),
    );
    await expect(
      addMember(client, "o1", { email: "x@example.com" }),
    ).rejects.toThrow("User is already an organization member (409).");
  });

  it("reports the server's reason for removing the last owner", async () => {
    const { client } = fakeClient(() =>
      response(400, { error: "Organization must keep at least one owner" }),
    );
    await expect(
      updateMember(client, "o1", "u1", { role: "member" }),
    ).rejects.toThrow("Organization must keep at least one owner (400).");
  });

  it("falls back to a named failure when the server gives no reason", async () => {
    const { client } = fakeClient(() => response(500, {}));
    await expect(
      addMember(client, "o1", { email: "x@example.com" }),
    ).rejects.toThrow("Membership request failed (500).");
  });

  it("maps a 404 on addMember to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(
      addMember(client, "missing", { email: "x@example.com" }),
    ).rejects.toThrow(/No organization found/);
  });

  it("maps a 404 on updateMember to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(
      updateMember(client, "o1", "missing", { roles: ["admin"] }),
    ).rejects.toThrow(/No such organization or member/);
  });

  it("maps a 404 on removeMember to a clear error", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(removeMember(client, "o1", "missing")).rejects.toThrow(
      /No such organization or member/,
    );
  });
});
