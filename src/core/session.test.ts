import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import {
  getTokens,
  KeychainUnavailableError,
  saveTokens,
  setBackendForTesting,
  type KeychainBackend,
} from "./keychain.js";
import { clearLocalSession, fetchIdentity, revokeSession } from "./session.js";

function response<T>(status: number, data: T | null): ApiResponse<T> {
  return { ok: status >= 200 && status < 300, status, data, headers: new Headers() };
}

const profile = { name: "default", instanceUrl: "https://auth.example.com" };

function fakeClient(
  handler: (method: string, path: string) => ApiResponse<unknown>,
): AuthClient {
  return {
    profile: { ...profile },
    get: async (path) => handler("GET", path) as never,
    post: async (path) => handler("POST", path) as never,
    request: async (path, init) =>
      handler((init?.method ?? "GET").toUpperCase(), path) as never,
  };
}

function memoryBackend(): KeychainBackend {
  const store = new Map<string, string>();
  return {
    get: (account) => store.get(account) ?? null,
    set: (account, secret) => {
      store.set(account, secret);
    },
    delete: (account) => store.delete(account),
  };
}

describe("fetchIdentity", () => {
  it("maps the /users/me user object", async () => {
    const client = fakeClient((method, path) => {
      expect(method).toBe("GET");
      expect(path).toBe("/users/me");
      return response(200, {
        user: {
          id: "user-1",
          email: "dev@example.com",
          roles: ["admin", "user"],
        },
      });
    });

    const identity = await fetchIdentity(client);
    expect(identity).toEqual({
      sub: "user-1",
      email: "dev@example.com",
      roles: ["admin", "user"],
    });
  });

  it("defaults roles to an empty array and throws on a non-ok response", async () => {
    const ok = fakeClient(() => response(200, { user: { id: "u" } }));
    expect((await fetchIdentity(ok)).roles).toEqual([]);

    const bad = fakeClient(() => response(500, null));
    await expect(fetchIdentity(bad)).rejects.toThrow(/could not load/i);
  });
});

describe("revokeSession", () => {
  it("deletes the current session by default", async () => {
    const seen: string[] = [];
    const client = fakeClient((method, path) => {
      seen.push(`${method} ${path}`);
      return response(200, { message: "ok" });
    });

    expect(await revokeSession(client)).toBe(true);
    expect(seen).toEqual(["DELETE /logout"]);
  });

  it("deletes every session with --all", async () => {
    const seen: string[] = [];
    const client = fakeClient((method, path) => {
      seen.push(`${method} ${path}`);
      return response(200, { message: "ok" });
    });

    expect(await revokeSession(client, { all: true })).toBe(true);
    expect(seen).toEqual(["DELETE /logout/all"]);
  });

  it("reports a non-ok revoke as false", async () => {
    const client = fakeClient(() => response(500, null));
    expect(await revokeSession(client)).toBe(false);
  });
});

describe("clearLocalSession", () => {
  let configHome: string;

  beforeEach(() => {
    configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-session-"));
    process.env.XDG_CONFIG_HOME = configHome;
    delete process.env.SEAMLESS_REFRESH_TOKEN;
  });

  afterEach(() => {
    setBackendForTesting(null);
    fs.rmSync(configHome, { recursive: true, force: true });
    delete process.env.XDG_CONFIG_HOME;
  });

  it("removes the stored tokens", async () => {
    setBackendForTesting(memoryBackend());
    await saveTokens(profile, { accessToken: "a", refreshToken: "r" });

    await clearLocalSession(profile);
    expect(await getTokens(profile)).toBeNull();
  });

  it("does not throw when the keychain is unavailable", async () => {
    setBackendForTesting({
      get: () => null,
      set: () => {},
      delete: () => {
        throw new KeychainUnavailableError();
      },
    });

    await expect(clearLocalSession(profile)).resolves.toBeUndefined();
  });

  it("propagates unexpected errors", async () => {
    setBackendForTesting({
      get: () => null,
      set: () => {},
      delete: () => {
        throw new Error("disk on fire");
      },
    });

    await expect(clearLocalSession(profile)).rejects.toThrow(/disk on fire/);
  });
});
