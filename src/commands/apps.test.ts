import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/authClient.js", async () => {
  const actual =
    await vi.importActual<typeof import("../core/authClient.js")>(
      "../core/authClient.js",
    );
  return { ...actual, createPortalClient: vi.fn() };
});

import { createPortalClient, ReauthRequiredError } from "../core/authClient.js";
import type { AuthClient } from "../core/authClient.js";
import type { ApiResponse } from "../core/http.js";
import { runApps } from "./apps.js";

function response<T>(status: number, data: T | null): ApiResponse<T> {
  return { ok: status >= 200 && status < 300, status, data, headers: new Headers() };
}

// The real portal.ts runs against this, so the tests cover the request paths and
// the mapping as well as the printed output.
function fakeClient(replies: ApiResponse<unknown>[]): {
  client: AuthClient;
  paths: string[];
} {
  const paths: string[] = [];
  let i = 0;
  const next = () => replies[Math.min(i++, replies.length - 1)];

  const client = {
    profile: { name: "__portal__", instanceUrl: "https://portal.example.com" },
    request: async (path: string) => {
      paths.push(path);
      return next();
    },
    get: async (path: string) => {
      paths.push(path);
      return next();
    },
    post: async (path: string) => {
      paths.push(path);
      return next();
    },
  } as unknown as AuthClient;

  return { client, paths };
}

// Real UUIDs: `apps get` sends a UUID straight to the control plane and resolves
// anything else against the list, so the id format decides which path runs.
const ACME_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ID = "22222222-2222-4222-8222-222222222222";

const acme = {
  id: ACME_ID,
  name: "Acme",
  instanceUrl: "https://acme.seamlessauth.com",
  consoleUrl: "https://acme.seamlessauth.com/console",
  infraId: "acme",
  servicePlan: "mvp",
  status: "deployed",
  hostedRegion: "us-east-1",
  devMode: false,
  ownerEmail: ["dev@example.com"],
  createdAt: "2026-07-01T00:00:00.000Z",
  serviceTokenMetadata: {
    maskedToken: "****abcd",
    createdAt: "2026-07-02T00:00:00.000Z",
  },
};

// No infraId: not provisioned yet, so it has no short reference to show.
const pending = { id: PENDING_ID, name: "Pending", status: "provisioning" };

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.SEAMLESS_PORTAL_API_URL = "http://localhost:3000";
  vi.mocked(createPortalClient).mockReset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SEAMLESS_PORTAL_API_URL;
});

function output(): string {
  return logSpy.mock.calls.map((c) => c[0] as string).join("\n");
}

describe("apps list", () => {
  it("prints a table and marks an application that is still provisioning", async () => {
    const { client, paths } = fakeClient([
      response(200, { applications: [acme, pending] }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["list"]);

    expect(paths[0]).toBe("http://localhost:3000/applications");
    const out = output();
    expect(out).toContain("ID");
    expect(out).toContain("NAME");
    // The reference is what `apps get` and `init --app` take, so it has to be
    // readable straight off the list: the infra id when there is one, and the
    // UUID for an application that has not been provisioned yet.
    expect(out).toContain("acme");
    expect(out).toContain(PENDING_ID);
    expect(out).toContain("Acme");
    expect(out).toContain("https://acme.seamlessauth.com");
    expect(out).toContain("Pending");
    expect(out).toContain("(provisioning)");
    expect(out).toContain("2 applications.");
  });

  it("defaults to list when no subcommand is given", async () => {
    const { client } = fakeClient([response(200, { applications: [acme] })]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps([]);

    expect(output()).toContain("Acme");
    expect(output()).toContain("1 application.");
  });

  it("points at the dashboard when the account owns nothing", async () => {
    const { client } = fakeClient([response(200, { applications: [] })]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["list"]);

    expect(output()).toContain("No managed applications.");
    expect(output()).toContain("dashboard.seamlessauth.com");
  });

  it("emits mapped applications with --json", async () => {
    const { client } = fakeClient([response(200, { applications: [acme] })]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["list", "--json"]);

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed[0]).toMatchObject({
      id: ACME_ID,
      infraId: "acme",
      instanceUrl: "https://acme.seamlessauth.com",
      hasServiceToken: true,
    });
    expect(output()).not.toContain("NAME");
  });
});

describe("apps get", () => {
  it("sends a UUID straight to the control plane and prints the detail view", async () => {
    const { client, paths } = fakeClient([
      response(200, { application: acme }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", ACME_ID]);

    expect(paths).toEqual([`http://localhost:3000/applications/${ACME_ID}`]);
    const out = output();
    expect(out).toContain("Acme");
    expect(out).toContain("us-east-1");
    expect(out).toContain("dev@example.com");
    expect(out).toContain("****abcd");
    expect(out).toContain("https://acme.seamlessauth.com/console");
    expect(out).toContain("off");
  });

  it("reports no token and a missing instance URL", async () => {
    const { client } = fakeClient([response(200, { application: pending })]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", "app-2"]);

    expect(output()).toContain("none issued");
    expect(output()).toContain("(provisioning)");
  });

  it("falls back to a generic marker when the token metadata has no mask", async () => {
    const { client } = fakeClient([
      response(200, { application: { ...pending, serviceTokenMetadata: {} } }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", "app-2"]);

    expect(output()).toContain("(issued)");
  });

  it("shows dev mode, frontend, and trial expiry for a trial application", async () => {
    const { client } = fakeClient([
      response(200, {
        application: {
          ...pending,
          devMode: true,
          servicePlan: "trial",
          frontendUrl: "https://trial.example.com",
          trialExpiresAt: "2026-08-01T00:00:00.000Z",
        },
      }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", "app-2"]);

    const out = output();
    expect(out).toContain("on");
    expect(out).toContain("https://trial.example.com");
    expect(out).toContain("2026-08-01T00:00:00.000Z");
  });

  it("emits the mapped application with --json", async () => {
    const { client } = fakeClient([response(200, { application: acme })]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", ACME_ID, "--json"]);

    expect(JSON.parse(logSpy.mock.calls[0][0] as string).id).toBe(ACME_ID);
  });

  it("requires a reference", async () => {
    await expect(runApps(["get"])).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Usage: seamless apps get <id|name|infra-id>"),
    );
  });

  it("resolves an infra id against the list, without a doomed lookup first", async () => {
    const { client, paths } = fakeClient([
      response(200, { applications: [acme, pending] }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", "ACME"]);

    // Only the list request: the control plane looks up by primary key, so
    // asking it for an infra id could only 404.
    expect(paths).toEqual(["http://localhost:3000/applications"]);
    expect(output()).toContain("Acme");
  });

  it("resolves a name", async () => {
    const { client } = fakeClient([
      response(200, { applications: [acme, pending] }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await runApps(["get", "pending"]);

    expect(output()).toContain("Pending");
  });

  it("asks for an id when a reference is ambiguous", async () => {
    const { client } = fakeClient([
      response(200, { applications: [acme, { ...acme, id: "app-9" }] }),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await expect(runApps(["get", "Acme"])).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("matches 2 applications"),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${ACME_ID}, app-9`),
    );
  });

  it("asks the control plane when nothing in the list matches", async () => {
    const { client, paths } = fakeClient([
      response(200, { applications: [acme] }),
      response(404, null),
    ]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await expect(runApps(["get", "ghost"])).rejects.toThrow("exit:1");
    expect(paths).toEqual([
      "http://localhost:3000/applications",
      "http://localhost:3000/applications/ghost",
    ]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Managed application "ghost" was not found.'),
    );
  });

  it("reports a non-404 failure without falling back", async () => {
    const { client, paths } = fakeClient([response(500, null)]);
    vi.mocked(createPortalClient).mockResolvedValue(client);

    await expect(runApps(["get", ACME_ID])).rejects.toThrow("exit:1");
    expect(paths).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
  });
});

describe("apps errors", () => {
  it("tells a signed-out developer to log in", async () => {
    vi.mocked(createPortalClient).mockRejectedValue(
      new ReauthRequiredError("You are not signed in to the Seamless portal."),
    );

    await expect(runApps(["list"])).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not signed in to the Seamless portal"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("rejects an unknown subcommand", async () => {
    await expect(runApps(["destroy"])).rejects.toThrow("exit:1");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown apps subcommand: destroy"),
    );
  });

  it("propagates unexpected errors", async () => {
    vi.mocked(createPortalClient).mockRejectedValue(new Error("disk on fire"));

    await expect(runApps(["list"])).rejects.toThrow("disk on fire");
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
