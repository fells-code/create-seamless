import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import { execSync } from "child_process";

import { runCheck } from "./check.js";

vi.mock("fs", () => {
  const fns = {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
  return { default: fns, ...fns };
});

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

const CONFIG = {
  services: {
    web: { path: "web" },
    api: { path: "api" },
    admin: { mode: "image" },
  },
  docker: { composeFile: "docker-compose.yml" },
};

let logs: string[];

beforeEach(() => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
    logs.push(String(msg ?? ""));
  });
  vi.restoreAllMocks;
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.readFileSync).mockReset();
  vi.mocked(execSync).mockReset();
  // Default global fetch to something the test overrides per-case.
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function output(): string {
  return logs.join("\n");
}

describe("runCheck", () => {
  it("stops early and points at init when the config file is missing", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await runCheck();

    expect(output()).toContain("seamless.config.json not found");
    expect(output()).toContain("seamless init");
    // No further checks should have run.
    expect(execSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it("runs every check on a healthy stack", async () => {
    // config present, web/api dirs present, compose file present.
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(CONFIG));
    // docker --version and docker ps both succeed; containers include "api".
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (String(cmd).includes("docker ps")) {
        return Buffer.from("web\napi\nauth\n");
      }
      return Buffer.from("");
    });
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

    await runCheck();

    const out = output();
    expect(out).toContain("Config file found");
    expect(out).toContain("Web project detected");
    expect(out).toContain("API project detected");
    expect(out).toContain("Docker is installed");
    expect(out).toContain("Docker Compose file found");
    expect(out).toContain("Containers running");
    expect(out).toContain("API is healthy");
    expect(out).toContain("Auth is healthy");
    expect(out).toContain("Console is healthy");
    expect(out).toContain("Check complete.");
  });

  it("reports the unhealthy branches when everything is missing or down", async () => {
    // config present so we proceed, but web/api/compose paths missing.
    vi.mocked(fs.existsSync).mockImplementation((p: string) => {
      return String(p).endsWith("seamless.config.json");
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(CONFIG));
    // docker --version throws (not installed); docker ps returns names without "api".
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (String(cmd).includes("docker --version")) {
        throw new Error("no docker");
      }
      if (String(cmd).includes("docker ps")) {
        return Buffer.from("web\nauth\n");
      }
      return Buffer.from("");
    });
    // API returns a non-ok status; others reject.
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      if (String(url).includes(":3000")) {
        return { ok: false, status: 503 } as Response;
      }
      throw new Error("connection refused");
    });

    await runCheck();

    const out = output();
    expect(out).toContain("Web project missing");
    expect(out).toContain("API project missing");
    expect(out).toContain("Docker not found");
    expect(out).toContain("docker-compose.yml missing");
    expect(out).toContain("API container not running");
    expect(out).toContain("API returned 503");
    expect(out).toContain("Auth not reachable");
    expect(out).toContain("Console not reachable");
  });

  it("validates the remote instance for a managed project and skips Docker checks", async () => {
    const managed = {
      services: {
        web: { path: "web" },
        api: { path: "api" },
        auth: {
          mode: "managed",
          instanceUrl: "https://acme.seamlessauth.com",
          applicationName: "Acme",
        },
      },
      docker: null,
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(managed));
    const seen: string[] = [];
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      seen.push(String(url));
      return { ok: true, status: 200 } as Response;
    });

    await runCheck();

    const out = output();
    expect(out).toContain("Managed instance: Acme");
    expect(out).toContain("Auth instance reachable");
    expect(seen).toContain("https://acme.seamlessauth.com/health/status");
    // Docker/compose/container checks must not run for managed.
    expect(execSync).not.toHaveBeenCalled();
    expect(out).not.toContain("Docker Compose file");
    expect(seen).not.toContain("http://localhost:5312/health/status");
  });

  it("reports a friendly error on a malformed config file instead of crashing", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("{ not json");

    await expect(runCheck()).resolves.toBeUndefined();

    expect(output()).toContain("not valid JSON");
    expect(execSync).not.toHaveBeenCalled();
  });

  it("probes the API /console URL in API-served mode", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        ...CONFIG,
        services: {
          ...CONFIG.services,
          admin: { mode: "api", url: "http://localhost:3000/console" },
        },
      }),
    );
    vi.mocked(execSync).mockReturnValue(Buffer.from("api\n"));
    const seen: string[] = [];
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      seen.push(String(url));
      return { ok: true, status: 200 } as Response;
    });

    await runCheck();

    expect(seen).toContain("http://localhost:3000/console");
    expect(seen).not.toContain("http://localhost:5174");
    expect(output()).toContain("Console is healthy");
  });

  it("skips the console probe when hosting is none", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        ...CONFIG,
        services: { ...CONFIG.services, admin: { mode: "none" } },
      }),
    );
    vi.mocked(execSync).mockReturnValue(Buffer.from("api\n"));
    const seen: string[] = [];
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      seen.push(String(url));
      return { ok: true, status: 200 } as Response;
    });

    await runCheck();

    expect(seen).not.toContain("http://localhost:5174");
    expect(seen).not.toContain("http://localhost:3000/console");
    expect(output()).not.toContain("Console");
  });

  it("reports a container check failure when docker ps throws", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(CONFIG));
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (String(cmd).includes("docker ps")) {
        throw new Error("daemon down");
      }
      return Buffer.from("");
    });
    vi.mocked(fetch).mockRejectedValue(new Error("down"));

    await runCheck();

    expect(output()).toContain("Failed to check containers");
  });
});
