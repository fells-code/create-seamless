import { describe, expect, it } from "vitest";
import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import {
  listSessions,
  revokeAllSessions,
  revokeSessionById,
} from "./sessions.js";

function response<T>(status: number, data: T | null): ApiResponse<T> {
  return { ok: status >= 200 && status < 300, status, data, headers: new Headers() };
}

function fakeClient(
  handler: (method: string, path: string) => ApiResponse<unknown>,
): AuthClient {
  return {
    profile: { name: "default", instanceUrl: "https://auth.example.com" },
    get: async (path) => handler("GET", path) as never,
    post: async (path) => handler("POST", path) as never,
    request: async (path, init) =>
      handler((init?.method ?? "GET").toUpperCase(), path) as never,
  };
}

describe("listSessions", () => {
  it("maps the session list and the current marker", async () => {
    const client = fakeClient((method, path) => {
      expect(`${method} ${path}`).toBe("GET /sessions");
      return response(200, {
        total: 2,
        sessions: [
          {
            id: "s1",
            deviceName: "MacBook",
            ipAddress: "203.0.113.4",
            userAgent: "curl/8",
            lastUsedAt: "2026-07-13T10:00:00.000Z",
            expiresAt: "2026-07-20T10:00:00.000Z",
            current: true,
          },
          { id: "s2", current: false },
        ],
      });
    });

    const { sessions, unreadable } = await listSessions(client);
    expect(sessions).toHaveLength(2);
    expect(unreadable).toBe(0);
    expect(sessions[0]).toMatchObject({
      id: "s1",
      deviceName: "MacBook",
      ipAddress: "203.0.113.4",
      current: true,
    });
    expect(sessions[1]).toEqual({ id: "s2", current: false });
  });

  // A row without a usable id is a session the developer has and cannot revoke, so
  // it is counted rather than quietly dropped.
  it("counts entries it could not read instead of hiding them", async () => {
    const withJunk = fakeClient(() =>
      response(200, { sessions: [{ id: "ok", current: false }, {}, 42, null] }),
    );

    expect(await listSessions(withJunk)).toEqual({
      sessions: [{ id: "ok", current: false }],
      unreadable: 3,
    });
  });

  it("reports no unreadable rows when the instance sends none", async () => {
    const client = fakeClient(() => response(200, { sessions: [] }));
    expect(await listSessions(client)).toEqual({ sessions: [], unreadable: 0 });
  });

  it("throws on a non-ok response", async () => {
    const bad = fakeClient(() => response(500, null));
    await expect(listSessions(bad)).rejects.toThrow(/could not list/i);
  });
});

describe("revokeSessionById", () => {
  it("deletes by id and URL-encodes it", async () => {
    const seen: string[] = [];
    const client = fakeClient((method, path) => {
      seen.push(`${method} ${path}`);
      return response(200, { message: "ok" });
    });

    const res = await revokeSessionById(client, "a b/c");
    expect(res).toEqual({ ok: true, status: 200 });
    expect(seen).toEqual(["DELETE /sessions/a%20b%2Fc"]);
  });

  it("surfaces a 404 for an unknown session", async () => {
    const client = fakeClient(() => response(404, { error: "Session not found" }));
    expect(await revokeSessionById(client, "gone")).toEqual({
      ok: false,
      status: 404,
    });
  });
});

describe("revokeAllSessions", () => {
  it("deletes the collection", async () => {
    const seen: string[] = [];
    const client = fakeClient((method, path) => {
      seen.push(`${method} ${path}`);
      return response(200, { message: "ok" });
    });

    const res = await revokeAllSessions(client);
    expect(res).toEqual({ ok: true, status: 200 });
    expect(seen).toEqual(["DELETE /sessions"]);
  });
});
