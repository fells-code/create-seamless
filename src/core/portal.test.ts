import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthClient } from "./authClient.js";
import type { ApiResponse } from "./http.js";
import type { Profile } from "./config.js";
import {
  DEFAULT_PORTAL_API_URL,
  PortalError,
  getApplication,
  getPortalApiUrl,
  listApplications,
  resolveAppInstanceUrl,
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
            instanceUrl: "https://acme.seamlessauth.com/infra-1",
            consoleUrl: "https://acme.seamlessauth.com/infra-1/console",
            infraId: "acme",
            servicePlan: "mvp",
            status: "deployed",
            hostedRegion: "us-east-1",
            devMode: false,
            ownerEmail: ["dev@example.com", 42],
            createdAt: "2026-07-01T00:00:00.000Z",
            serviceTokenMetadata: {
              maskedToken: "****abcd",
              createdAt: "2026-07-02T00:00:00.000Z",
            },
          },
          { id: "app-2", name: "Beta", domain: "https://beta.seamlessauth.com" },
          { id: "no-domain" },
          { name: "no id at all" },
        ],
      }),
    ]);

    const apps = await listApplications(client);

    expect(calls[0]).toEqual({
      method: "GET",
      path: "http://localhost:5001/applications",
    });

    // An application without a URL is still provisioning and must be listed;
    // only one without an id is unusable.
    expect(apps).toHaveLength(3);
    expect(apps[0]).toMatchObject({
      id: "app-1",
      name: "Acme",
      instanceUrl: "https://acme.seamlessauth.com/infra-1",
      domain: "https://acme.seamlessauth.com",
      consoleUrl: "https://acme.seamlessauth.com/infra-1/console",
      infraId: "acme",
      servicePlan: "mvp",
      status: "deployed",
      hostedRegion: "us-east-1",
      devMode: false,
      ownerEmails: ["dev@example.com"],
      hasServiceToken: true,
      serviceToken: {
        maskedToken: "****abcd",
        createdAt: "2026-07-02T00:00:00.000Z",
      },
    });
    expect(apps[1].hasServiceToken).toBe(false);
    expect(apps[1].serviceToken).toBeUndefined();
    expect(apps[2].name).toBe("no-domain");
    expect(apps[2].ownerEmails).toEqual([]);
  });

  it("accepts a single owner email as a string", async () => {
    const { client } = fakeClient([
      response(200, {
        applications: [{ id: "app-1", ownerEmail: "solo@example.com" }],
      }),
    ]);

    const apps = await listApplications(client);
    expect(apps[0].ownerEmails).toEqual(["solo@example.com"]);
  });

  it("returns an empty list when the payload has no applications array", async () => {
    const { client } = fakeClient([response(200, {})]);
    await expect(listApplications(client)).resolves.toEqual([]);
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

describe("resolveAppInstanceUrl", () => {
  const base = { id: "a", name: "A", ownerEmails: [], hasServiceToken: false };

  it("prefers instanceUrl over the legacy domain column", () => {
    expect(
      resolveAppInstanceUrl({
        ...base,
        instanceUrl: "https://acme.seamlessauth.com/infra-1",
        domain: "https://acme.seamlessauth.com",
      }),
    ).toBe("https://acme.seamlessauth.com/infra-1");
  });

  it("falls back to domain, and is undefined when neither is set", () => {
    expect(
      resolveAppInstanceUrl({ ...base, domain: "https://acme.seamlessauth.com" }),
    ).toBe("https://acme.seamlessauth.com");
    expect(resolveAppInstanceUrl(base)).toBeUndefined();
  });
});

describe("getApplication", () => {
  beforeEach(() => {
    process.env.SEAMLESS_PORTAL_API_URL = "http://localhost:5001";
  });
  afterEach(() => {
    delete process.env.SEAMLESS_PORTAL_API_URL;
  });

  it("requests one application and maps it", async () => {
    const { client, calls } = fakeClient([
      response(200, {
        message: "success",
        application: { id: "app 1", name: "Acme", status: "deployed" },
      }),
    ]);

    const app = await getApplication(client, "app 1");

    expect(calls[0]).toEqual({
      method: "GET",
      path: "http://localhost:5001/applications/app%201",
    });
    expect(app).toMatchObject({ id: "app 1", name: "Acme", status: "deployed" });
  });

  it("maps a 404 to a not-found error", async () => {
    const { client } = fakeClient([response(404, null)]);
    await expect(getApplication(client, "missing")).rejects.toThrow(
      /was not found/,
    );
  });

  it("treats a 401 or 403 as an authorization failure", async () => {
    const forbidden = fakeClient([response(403, null)]);
    await expect(
      getApplication(forbidden.client, "app-1"),
    ).rejects.toBeInstanceOf(PortalError);

    const unauth = fakeClient([response(401, null)]);
    await expect(getApplication(unauth.client, "app-1")).rejects.toBeInstanceOf(
      PortalError,
    );
  });

  it("reports other failures with the status code", async () => {
    const { client } = fakeClient([response(500, null)]);
    await expect(getApplication(client, "app-1")).rejects.toThrow(/500/);
  });

  it("rejects a payload without a usable application", async () => {
    const missing = fakeClient([response(200, { message: "success" })]);
    await expect(getApplication(missing.client, "app-1")).rejects.toThrow(
      /unexpected response/,
    );

    const idless = fakeClient([response(200, { application: { name: "x" } })]);
    await expect(getApplication(idless.client, "app-1")).rejects.toThrow(
      /unexpected response/,
    );
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

  it("treats a 401 or 403 as an authorization failure", async () => {
    const forbidden = fakeClient([response(403, null)]);
    await expect(
      rotateServiceToken(forbidden.client, "app-1"),
    ).rejects.toBeInstanceOf(PortalError);

    const unauth = fakeClient([response(401, null)]);
    await expect(
      rotateServiceToken(unauth.client, "app-1"),
    ).rejects.toBeInstanceOf(PortalError);
  });

  it("fails when the response omits a token", async () => {
    const { client } = fakeClient([response(200, { message: "ok" })]);
    await expect(rotateServiceToken(client, "app-1")).rejects.toBeInstanceOf(
      PortalError,
    );
  });
});
