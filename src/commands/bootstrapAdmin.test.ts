import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveBootstrapSecret } from "../core/bootstrapSecret.js";
import { getActiveProfile } from "../core/config.js";
import { runBootstrapAdmin } from "./bootstrapAdmin.js";

vi.mock("../core/bootstrapSecret.js", () => ({
  resolveBootstrapSecret: vi.fn(),
}));

vi.mock("../core/config.js", () => ({
  getActiveProfile: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(),
}));

import { intro, outro, text, confirm, spinner } from "@clack/prompts";

let logs: string[];
let errors: string[];
let exitSpy: ReturnType<typeof vi.spyOn>;
let spinnerStart: ReturnType<typeof vi.fn>;
let spinnerStop: ReturnType<typeof vi.fn>;
const SAVED_ENV = { ...process.env };

beforeEach(() => {
  logs = [];
  errors = [];

  vi.mocked(resolveBootstrapSecret).mockReset();
  vi.mocked(getActiveProfile).mockReset();
  vi.mocked(intro).mockReset();
  vi.mocked(outro).mockReset();
  vi.mocked(text).mockReset();
  vi.mocked(confirm).mockReset();
  vi.mocked(spinner).mockReset();

  vi.mocked(getActiveProfile).mockReturnValue(undefined);
  vi.mocked(confirm).mockResolvedValue(true);

  spinnerStart = vi.fn();
  spinnerStop = vi.fn();
  vi.mocked(spinner).mockReturnValue({
    start: spinnerStart,
    stop: spinnerStop,
  } as never);

  vi.stubGlobal("fetch", vi.fn());

  vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
    logs.push(String(msg ?? ""));
  });
  vi.spyOn(console, "error").mockImplementation((msg?: unknown) => {
    errors.push(String(msg ?? ""));
  });
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);

  process.env = { ...SAVED_ENV };
  delete process.env.SEAMLESS_API_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...SAVED_ENV };
});

function output(): string {
  return logs.join("\n");
}

function errOutput(): string {
  return errors.join("\n");
}

describe("runBootstrapAdmin — email prompt", () => {
  it("uses the provided email argument without prompting", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue("auto-secret");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(text).not.toHaveBeenCalled();
    expect(output()).toContain("Invite sent to admin@example.com");
  });

  it("prompts for an email when none is given", async () => {
    vi.mocked(text).mockResolvedValue("prompted@example.com" as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin([]);

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Admin email address" }),
    );
    expect(output()).toContain("Invite sent to prompted@example.com");
  });

  it("validates the prompted email address", async () => {
    vi.mocked(text).mockResolvedValue("prompted@example.com" as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin([]);

    const call = vi.mocked(text).mock.calls[0][0] as {
      validate: (v?: string) => string | undefined;
    };
    expect(call.validate("")).toBe("Enter a valid email address");
    expect(call.validate("not-an-email")).toBe("Enter a valid email address");
    expect(call.validate("ok@example.com")).toBeUndefined();
  });
});

describe("runBootstrapAdmin — confirm cancellation", () => {
  it("outputs Cancelled and returns without calling fetch", async () => {
    vi.mocked(confirm).mockResolvedValue(false);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(outro).toHaveBeenCalledWith("Cancelled.");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("runBootstrapAdmin — API URL resolution", () => {
  it("defaults to localhost:3000 when no profile or override is set", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/auth/internal/bootstrap/admin-invite",
      expect.anything(),
    );
  });

  it("targets the active profile's instance URL", async () => {
    vi.mocked(getActiveProfile).mockReturnValue({
      name: "prod",
      instanceUrl: "https://auth.prod.example.com",
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(fetch).toHaveBeenCalledWith(
      "https://auth.prod.example.com/auth/internal/bootstrap/admin-invite",
      expect.anything(),
    );
  });

  it("resolves the profile named by the --profile flag", async () => {
    vi.mocked(getActiveProfile).mockReturnValue({
      name: "staging",
      instanceUrl: "https://auth.staging.example.com",
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["--profile", "staging", "admin@example.com"]);

    expect(getActiveProfile).toHaveBeenCalledWith({ profileFlag: "staging" });
    expect(fetch).toHaveBeenCalledWith(
      "https://auth.staging.example.com/auth/internal/bootstrap/admin-invite",
      expect.anything(),
    );
  });

  it("lets SEAMLESS_API_URL override the profile", async () => {
    process.env.SEAMLESS_API_URL = "https://api.example.com";
    vi.mocked(getActiveProfile).mockReturnValue({
      name: "prod",
      instanceUrl: "https://auth.prod.example.com",
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(getActiveProfile).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/auth/internal/bootstrap/admin-invite",
      expect.anything(),
    );
  });
});

describe("runBootstrapAdmin — bootstrap secret resolution", () => {
  it("uses an automatically resolved secret without prompting", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue("auto-secret");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(text).not.toHaveBeenCalled();
    expect(output()).toContain("Using bootstrap secret from local environment");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer auto-secret",
    });
  });

  it("prompts for the secret when none is resolved automatically", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue(null);
    vi.mocked(text).mockResolvedValue("typed-secret" as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(text).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Bootstrap secret" }),
    );
    expect(output()).toContain("No bootstrap secret detected automatically.");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer typed-secret",
    });
  });

  it("validates the prompted bootstrap secret", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue(null);
    vi.mocked(text).mockResolvedValue("typed-secret" as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    const call = vi.mocked(text).mock.calls[0][0] as {
      validate: (v?: string) => string | undefined;
    };
    expect(call.validate("")).toBe("Bootstrap secret is required");
    expect(call.validate("something")).toBeUndefined();
  });
});

describe("runBootstrapAdmin — request outcomes", () => {
  it("prints the registration URL when the response includes one", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue("secret");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: "https://auth.example.com/register/abc" } }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(spinnerStart).toHaveBeenCalledWith("Creating bootstrap invite...");
    expect(spinnerStop).toHaveBeenCalledWith("Done");
    expect(output()).toContain("Registration URL");
    expect(output()).toContain("https://auth.example.com/register/abc");
    expect(outro).toHaveBeenCalledWith("Bootstrap complete.");
  });

  it("prints an invite-sent message when there is no registration URL", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue("secret");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    } as Response);

    await runBootstrapAdmin(["admin@example.com"]);

    expect(output()).toContain("Invite sent to admin@example.com");
  });

  it("prints the error body and exits 1 on a non-ok response", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue("secret");
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "already bootstrapped" }),
    } as Response);

    await expect(runBootstrapAdmin(["admin@example.com"])).rejects.toThrow(
      "process.exit(1)",
    );

    expect(spinnerStop).toHaveBeenCalledWith("Failed");
    expect(errOutput()).toContain("Error creating bootstrap invite");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints an unexpected-error message and exits 1 when fetch throws", async () => {
    vi.mocked(resolveBootstrapSecret).mockReturnValue("secret");
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(runBootstrapAdmin(["admin@example.com"])).rejects.toThrow(
      "process.exit(1)",
    );

    expect(spinnerStop).toHaveBeenCalledWith("Failed");
    expect(errOutput()).toContain("Unexpected error");
    expect(errOutput()).toContain("network down");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
