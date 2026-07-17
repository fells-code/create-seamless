import { describe, expect, it } from "vitest";
import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import {
  ConfigApiError,
  deepEqual,
  diffConfig,
  filterWritable,
  getRoles,
  getSystemConfig,
  parseValue,
  patchSystemConfig,
  PermissionError,
} from "./systemConfig.js";

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
  const record = (method: string, path: string, init?: RequestInit): ApiResponse<unknown> => {
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

describe("getSystemConfig", () => {
  it("returns the config from /system-config/admin", async () => {
    const { client } = fakeClient(({ method, path }) => {
      expect(`${method} ${path}`).toBe("GET /system-config/admin");
      return response(200, { app_name: "Acme", rate_limit: 100 });
    });
    expect(await getSystemConfig(client)).toEqual({
      app_name: "Acme",
      rate_limit: 100,
    });
  });

  it("maps 403 to a PermissionError", async () => {
    const { client } = fakeClient(() => response(403, { error: "Forbidden" }));
    await expect(getSystemConfig(client)).rejects.toBeInstanceOf(PermissionError);
  });

  it("throws a ConfigApiError on other failures", async () => {
    const { client } = fakeClient(() => response(500, null));
    await expect(getSystemConfig(client)).rejects.toBeInstanceOf(ConfigApiError);
  });
});

describe("patchSystemConfig", () => {
  it("PATCHes the admin endpoint and returns updatedKeys", async () => {
    const { client, calls } = fakeClient(() =>
      response(200, { success: true, updatedKeys: ["app_name"] }),
    );

    const result = await patchSystemConfig(client, { app_name: "Renamed" });
    expect(result).toEqual({ success: true, updatedKeys: ["app_name"] });
    expect(calls[0]).toEqual({
      method: "PATCH",
      path: "/system-config/admin",
      body: { app_name: "Renamed" },
    });
  });

  it("surfaces 400 validation details", async () => {
    const { client } = fakeClient(() =>
      response(400, { error: "Invalid payload", details: { rpid: "required" } }),
    );
    await expect(patchSystemConfig(client, { rpid: "" })).rejects.toThrow(
      /Invalid payload.*rpid/,
    );
  });

  it("surfaces a 400 without details as a bare reason", async () => {
    const { client } = fakeClient(() => response(400, { error: "Invalid payload" }));
    await expect(patchSystemConfig(client, { rpid: "" })).rejects.toThrow(
      "Invalid payload.",
    );
  });

  it("maps 403 to a PermissionError", async () => {
    const { client } = fakeClient(() => response(403, { error: "Forbidden" }));
    await expect(
      patchSystemConfig(client, { app_name: "x" }),
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("throws a ConfigApiError on other failures", async () => {
    const { client } = fakeClient(() => response(500, { error: "boom" }));
    await expect(
      patchSystemConfig(client, { app_name: "x" }),
    ).rejects.toBeInstanceOf(ConfigApiError);
  });

  it("defaults updatedKeys to an empty array when the response omits it", async () => {
    const { client } = fakeClient(() => response(200, { success: true }));
    expect(await patchSystemConfig(client, { app_name: "x" })).toEqual({
      success: true,
      updatedKeys: [],
    });
  });
});

describe("getRoles", () => {
  it("returns the roles array", async () => {
    const { client } = fakeClient(({ path }) => {
      expect(path).toBe("/system-config/roles");
      return response(200, { roles: ["admin", "user"] });
    });
    expect(await getRoles(client)).toEqual(["admin", "user"]);
  });

  it("returns an empty array when roles is missing", async () => {
    const { client } = fakeClient(() => response(200, {}));
    expect(await getRoles(client)).toEqual([]);
  });

  it("maps 403 to a PermissionError", async () => {
    const { client } = fakeClient(() => response(403, { error: "Forbidden" }));
    await expect(getRoles(client)).rejects.toBeInstanceOf(PermissionError);
  });

  it("throws a ConfigApiError on other failures", async () => {
    const { client } = fakeClient(() => response(500, null));
    await expect(getRoles(client)).rejects.toBeInstanceOf(ConfigApiError);
  });
});

describe("parseValue", () => {
  it("parses JSON scalars, arrays, and objects, and falls back to string", () => {
    expect(parseValue("true")).toBe(true);
    expect(parseValue("100")).toBe(100);
    expect(parseValue('["email_otp","passkey"]')).toEqual([
      "email_otp",
      "passkey",
    ]);
    expect(parseValue("15m")).toBe("15m");
    expect(parseValue("My App")).toBe("My App");
  });
});

describe("filterWritable", () => {
  it("keeps writable keys and reports the rest", () => {
    const { patch, dropped } = filterWritable({
      app_name: "Acme",
      rpid: "auth.example.com",
      frontend_url: "https://app.example.com",
      bogus: 1,
    });
    expect(patch).toEqual({ app_name: "Acme", rpid: "auth.example.com" });
    expect(dropped.sort()).toEqual(["bogus", "frontend_url"]);
  });
});

describe("deepEqual and diffConfig", () => {
  it("compares nested structures", () => {
    expect(deepEqual({ a: [1, 2], b: { c: 3 } }, { a: [1, 2], b: { c: 3 } })).toBe(
      true,
    );
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], { a: 1 })).toBe(false);
  });

  it("reports only changed and added keys from the local file", () => {
    const remote = {
      app_name: "Acme",
      rate_limit: 100,
      origins: ["https://a.example.com"],
    };
    const local = {
      app_name: "Acme",
      rate_limit: 250,
      login_methods: ["email_otp"],
    };

    expect(diffConfig(local, remote)).toEqual([
      { key: "rate_limit", from: 100, to: 250 },
      { key: "login_methods", from: undefined, to: ["email_otp"] },
    ]);
  });
});
