import { describe, expect, it } from "vitest";
import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import {
  ConfigApiError,
  createOAuthProvider,
  deepEqual,
  deleteOAuthProvider,
  diffConfig,
  filterWritable,
  getRoles,
  getSystemConfig,
  listOAuthProviders,
  isWritableKey,
  parseValue,
  patchSystemConfig,
  PermissionError,
  updateOAuthProvider,
  WRITABLE_KEYS,
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

describe("listOAuthProviders", () => {
  it("returns the providers array from the dedicated route", async () => {
    const { client } = fakeClient(({ method, path }) => {
      expect(`${method} ${path}`).toBe("GET /system-config/oauth-providers");
      return response(200, { providers: [{ id: "google" }, { id: "github" }] });
    });
    expect(await listOAuthProviders(client)).toEqual([
      { id: "google" },
      { id: "github" },
    ]);
  });

  it("returns an empty array when providers is missing", async () => {
    const { client } = fakeClient(() => response(200, {}));
    expect(await listOAuthProviders(client)).toEqual([]);
  });

  it("maps 403 to a PermissionError", async () => {
    const { client } = fakeClient(() => response(403, { error: "Forbidden" }));
    await expect(listOAuthProviders(client)).rejects.toBeInstanceOf(
      PermissionError,
    );
  });

  it("throws a ConfigApiError on other failures", async () => {
    const { client } = fakeClient(() => response(500, null));
    await expect(listOAuthProviders(client)).rejects.toBeInstanceOf(
      ConfigApiError,
    );
  });
});

describe("createOAuthProvider", () => {
  it("POSTs the provider and returns the created record", async () => {
    const { client, calls } = fakeClient(() =>
      response(201, { provider: { id: "google", name: "Google" } }),
    );

    const created = await createOAuthProvider(client, {
      id: "google",
      name: "Google",
    });
    expect(created).toEqual({ id: "google", name: "Google" });
    expect(calls[0]).toEqual({
      method: "POST",
      path: "/system-config/oauth-providers",
      body: { id: "google", name: "Google" },
    });
  });

  it("maps 409 to a ConfigApiError with the API message", async () => {
    const { client } = fakeClient(() =>
      response(409, { error: 'OAuth provider "google" already exists' }),
    );
    await expect(
      createOAuthProvider(client, { id: "google" }),
    ).rejects.toThrow(/already exists/);
  });

  it("surfaces 400 validation details", async () => {
    const { client } = fakeClient(() =>
      response(400, { error: "Invalid", details: { tokenUrl: "required" } }),
    );
    await expect(
      createOAuthProvider(client, { id: "google" }),
    ).rejects.toThrow(/Invalid.*tokenUrl/);
  });

  it("surfaces a 400 without details as a bare reason", async () => {
    const { client } = fakeClient(() =>
      response(400, { error: "Invalid OAuth provider" }),
    );
    await expect(
      createOAuthProvider(client, { id: "google" }),
    ).rejects.toThrow("Invalid OAuth provider.");
  });

  it("throws a ConfigApiError on other failures", async () => {
    const { client } = fakeClient(() => response(500, { error: "boom" }));
    await expect(
      createOAuthProvider(client, { id: "google" }),
    ).rejects.toThrow("Could not add OAuth provider (500).");
  });

  it("falls back to the input when the response omits the provider", async () => {
    const { client } = fakeClient(() => response(201, {}));
    expect(await createOAuthProvider(client, { id: "google" })).toEqual({
      id: "google",
    });
  });

  it("maps 403 to a PermissionError", async () => {
    const { client } = fakeClient(() => response(403, { error: "Forbidden" }));
    await expect(
      createOAuthProvider(client, { id: "google" }),
    ).rejects.toBeInstanceOf(PermissionError);
  });
});

describe("updateOAuthProvider", () => {
  it("PATCHes the id-scoped route with the update body", async () => {
    const { client, calls } = fakeClient(() =>
      response(200, { provider: { id: "google", enabled: false } }),
    );

    const updated = await updateOAuthProvider(client, "google", {
      enabled: false,
    });
    expect(updated).toEqual({ id: "google", enabled: false });
    expect(calls[0]).toEqual({
      method: "PATCH",
      path: "/system-config/oauth-providers/google",
      body: { enabled: false },
    });
  });

  it("maps 404 to a ConfigApiError naming the provider", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(
      updateOAuthProvider(client, "missing", { enabled: false }),
    ).rejects.toThrow(/"missing" not found/);
  });
});

describe("deleteOAuthProvider", () => {
  it("DELETEs the id-scoped route", async () => {
    const { client, calls } = fakeClient(() =>
      response(200, { success: true, id: "google" }),
    );

    await deleteOAuthProvider(client, "google");
    expect(calls[0]).toEqual({
      method: "DELETE",
      path: "/system-config/oauth-providers/google",
      body: undefined,
    });
  });

  it("maps 404 to a ConfigApiError", async () => {
    const { client } = fakeClient(() => response(404, { error: "not found" }));
    await expect(deleteOAuthProvider(client, "missing")).rejects.toBeInstanceOf(
      ConfigApiError,
    );
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

  // The instance types these as strings, so a value that happens to look like JSON
  // is still a string. Sending 123 for app_name is a type error the server rejects.
  it.each([
    ["app_name", "123"],
    ["app_name", "true"],
    ["app_name", "null"],
    ["rpid", "true"],
    ["access_token_ttl", "900"],
    ["refresh_token_ttl", "0"],
  ])("keeps %s=%s a string", (key, raw) => {
    expect(parseValue(raw, key)).toBe(raw);
  });

  it("keeps session_idle_ttl a string", () => {
    expect(parseValue("8", "session_idle_ttl")).toBe("8");
    expect(parseValue("8h", "session_idle_ttl")).toBe("8h");
  });

  it("still parses a non-string key's value", () => {
    expect(parseValue("250", "rate_limit")).toBe(250);
    expect(parseValue("true", "passkey_login_fallback_enabled")).toBe(true);
    expect(parseValue('["email_otp"]', "login_methods")).toEqual(["email_otp"]);
  });

  it("trims a string key's value", () => {
    expect(parseValue("  Acme  ", "app_name")).toBe("Acme");
  });

  it("behaves as before when no key is given", () => {
    expect(parseValue("123")).toBe(123);
  });
});

describe("isWritableKey", () => {
  it("accepts the keys filterWritable keeps", () => {
    for (const key of WRITABLE_KEYS) {
      expect(isWritableKey(key)).toBe(true);
    }
  });

  it("rejects read-only and unknown keys", () => {
    // frontend_url is in the config the instance returns but not in its strict
    // patch schema, so it is read-only rather than merely unlisted.
    expect(isWritableKey("frontend_url")).toBe(false);
    expect(isWritableKey("bogus")).toBe(false);
  });

  // These were absent from WRITABLE_KEYS while the instance accepted them, so
  // `config apply` dropped them without applying anything.
  it.each([
    "authenticator_policy",
    "session_idle_ttl",
    "max_concurrent_sessions",
    "magic_link_redirect_uris",
  ])("accepts %s, which the instance's patch schema takes", (key) => {
    expect(isWritableKey(key)).toBe(true);
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
