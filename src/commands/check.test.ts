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
    expect(out).toContain("Admin is healthy");
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
    expect(out).toContain("Admin not reachable");
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
