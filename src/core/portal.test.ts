import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import type { Profile } from "./config.js";
import {
  DEFAULT_PORTAL_API_URL,
  PortalError,
  getPortalApiUrl,
  listApplications,
  rotateServiceToken,
} from "./portal.js";

interface Call {
  method: "GET" | "POST" | "REQUEST";
  path: string;
  body?: unknown;
}

function response<T>(status: number, data: T | null): ApiResponse<T> {
  return {
    ok: status >= 200 && status < 300,
    status,
    data,
    headers: new Headers(),
  };
}

// A minimal AuthClient stand-in: it records the absolute URLs portal.ts builds
// and replays queued responses, so tests assert both the request shape and the
// parsing of each reply.
function fakeClient(replies: ApiResponse<unknown>[]): {
  client: AuthClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  let i = 0;
  const next = () => replies[Math.min(i++, replies.length - 1)];

  const profile: Profile = {
    name: "default",
    instanceUrl: "https://auth.example.com",
  };

  const client: AuthClient = {
    profile,
    request: async (path) => {
      calls.push({ method: "REQUEST", path });
      return next() as ApiResponse<never>;
    },
    get: async (path) => {
      calls.push({ method: "GET", path });
      return next() as ApiResponse<never>;
    },
    post: async (path, body) => {
      calls.push({ method: "POST", path, body });
      return next() as ApiResponse<never>;
    },
  };

  return { client, calls };
}

describe("getPortalApiUrl", () => {
  const original = process.env.SEAMLESS_PORTAL_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.SEAMLESS_PORTAL_API_URL;
    else process.env.SEAMLESS_PORTAL_API_URL = original;
  });

  it("defaults to the production control plane", () => {
    delete process.env.SEAMLESS_PORTAL_API_URL;
    expect(getPortalApiUrl()).toBe(DEFAULT_PORTAL_API_URL);
  });

  it("honors the override and strips a trailing slash", () => {
    process.env.SEAMLESS_PORTAL_API_URL = "http://localhost:5001/";
    expect(getPortalApiUrl()).toBe("http://localhost:5001");
  });
});

describe("listApplications", () => {
  beforeEach(() => {
    process.env.SEAMLESS_PORTAL_API_URL = "http://localhost:5001";
  });
  afterEach(() => {
    delete process.env.SEAMLESS_PORTAL_API_URL;
  });

  it("requests the portal host and maps applications", async () => {
    const { client, calls } = fakeClient([
      response(200, {
        applications: [
          {
            id: "app-1",
            name: "Acme",
            domain: "https://acme.seamlessauth.com",
            infraId: "acme",
            serviceTokenMetadata: { maskedToken: "****abcd" },
          },
          { id: "app-2", name: "Beta", domain: "https://beta.seamlessauth.com" },
          { id: "no-domain" },
        ],
      }),
    ]);

    const apps = await listApplications(client);

    expect(calls[0]).toEqual({
      method: "GET",
      path: "http://localhost:5001/applications",
    });
    expect(apps).toHaveLength(2);
    expect(apps[0]).toMatchObject({
      id: "app-1",
      name: "Acme",
      domain: "https://acme.seamlessauth.com",
      infraId: "acme",
      hasServiceToken: true,
    });
    expect(apps[1].hasServiceToken).toBe(false);
  });

  it("treats a 401 as an authorization failure", async () => {
    const { client } = fakeClient([response(401, null)]);
    await expect(listApplications(client)).rejects.toBeInstanceOf(PortalError);
  });

  it("reports other failures with the status code", async () => {
    const { client } = fakeClient([response(500, null)]);
    await expect(listApplications(client)).rejects.toThrow(/500/);
  });
});

describe("rotateServiceToken", () => {
  beforeEach(() => {
    process.env.SEAMLESS_PORTAL_API_URL = "http://localhost:5001";
  });
  afterEach(() => {
    delete process.env.SEAMLESS_PORTAL_API_URL;
  });

  it("posts to the rotate endpoint and returns the token", async () => {
    const { client, calls } = fakeClient([
      response(200, { serviceToken: "secret-token", message: "copy it" }),
    ]);

    const token = await rotateServiceToken(client, "app 1");

    expect(token).toBe("secret-token");
    expect(calls[0]).toEqual({
      method: "POST",
      path: "http://localhost:5001/applications/app%201/rotateServiceToken",
      body: undefined,
    });
  });

  it("maps a 404 to a not-found error", async () => {
    const { client } = fakeClient([response(404, null)]);
    await expect(rotateServiceToken(client, "missing")).rejects.toThrow(
      /not be found|not found/i,
    );
  });

  it("fails when the response omits a token", async () => {
    const { client } = fakeClient([response(200, { message: "ok" })]);
    await expect(rotateServiceToken(client, "app-1")).rejects.toBeInstanceOf(
      PortalError,
    );
  });
});
