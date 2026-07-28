import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pkg from "../package.json" with { type: "json" };

// Every command module is stubbed so importing index.ts (which runs main() at load)
// never touches real command logic. args.js stays real (extractFlag is pure).
vi.mock("./commands/init.js", () => ({ runCLI: vi.fn() }));
vi.mock("./commands/check.js", () => ({ runCheck: vi.fn() }));
vi.mock("./commands/help.js", () => ({ printHelp: vi.fn() }));
vi.mock("./commands/bootstrapAdmin.js", () => ({ runBootstrapAdmin: vi.fn() }));
vi.mock("./commands/verify.js", () => ({ runVerify: vi.fn() }));
vi.mock("./commands/profile.js", () => ({ runProfile: vi.fn() }));
vi.mock("./commands/login.js", () => ({ runLogin: vi.fn() }));
vi.mock("./commands/whoami.js", () => ({ runWhoami: vi.fn() }));
vi.mock("./commands/logout.js", () => ({ runLogout: vi.fn() }));
vi.mock("./commands/sessions.js", () => ({ runSessions: vi.fn() }));
vi.mock("./commands/config.js", () => ({ runConfig: vi.fn() }));
vi.mock("./commands/users.js", () => ({ runUsers: vi.fn() }));
vi.mock("./commands/org.js", () => ({ runOrg: vi.fn() }));
vi.mock("./commands/apps.js", () => ({ runApps: vi.fn() }));

const flush = () => new Promise((r) => setImmediate(r));

const ORIGINAL_ARGV = process.argv;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.argv = ORIGINAL_ARGV;
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
});

// Sets process.argv, imports index fresh so its module-level main() runs, and
// returns index's exports once the dispatch has settled.
async function dispatch(argv: string[]): Promise<Record<string, unknown>> {
  process.argv = ["node", "index.js", ...argv];
  const mod = await import("./index.js");
  await flush();
  return mod as unknown as Record<string, unknown>;
}

describe("index dispatcher", () => {
  it("prints help when no command is given", async () => {
    await dispatch([]);
    const { printHelp } = await import("./commands/help.js");
    expect(printHelp).toHaveBeenCalledTimes(1);
  });

  it.each(["-h", "--help"])("prints help for %s", async (flag) => {
    await dispatch([flag]);
    const { printHelp } = await import("./commands/help.js");
    expect(printHelp).toHaveBeenCalledTimes(1);
  });

  it.each(["-v", "--version"])("prints the version for %s", async (flag) => {
    await dispatch([flag]);
    expect(logSpy).toHaveBeenCalledWith(pkg.version);
  });

  it("dispatches init with parsed project name, aliases, profile and app flags", async () => {
    await dispatch(["init", "my-app", "--local", "--oauth", "--profile", "prod", "--app", "app1"]);
    const { runCLI } = await import("./commands/init.js");
    expect(runCLI).toHaveBeenCalledWith("my-app", ["oauth"], {
      profileFlag: "prod",
      appId: "app1",
      local: true,
    });
  });

  it("dispatches check", async () => {
    await dispatch(["check"]);
    const { runCheck } = await import("./commands/check.js");
    expect(runCheck).toHaveBeenCalledTimes(1);
  });

  it("dispatches bootstrap-admin with the remaining arguments", async () => {
    await dispatch(["bootstrap-admin", "--profile", "prod", "admin@example.com"]);
    const { runBootstrapAdmin } = await import("./commands/bootstrapAdmin.js");
    expect(runBootstrapAdmin).toHaveBeenCalledWith([
      "--profile",
      "prod",
      "admin@example.com",
    ]);
  });

  it("dispatches verify with the remaining args", async () => {
    await dispatch(["verify", "--local"]);
    const { runVerify } = await import("./commands/verify.js");
    expect(runVerify).toHaveBeenCalledWith(["--local"]);
  });

  it.each([
    ["profile", "./commands/profile.js", "runProfile"],
    ["login", "./commands/login.js", "runLogin"],
    ["whoami", "./commands/whoami.js", "runWhoami"],
    ["logout", "./commands/logout.js", "runLogout"],
    ["sessions", "./commands/sessions.js", "runSessions"],
    ["config", "./commands/config.js", "runConfig"],
    ["users", "./commands/users.js", "runUsers"],
    ["org", "./commands/org.js", "runOrg"],
    ["apps", "./commands/apps.js", "runApps"],
  ])("dispatches %s with the remaining args", async (cmd, modPath, fnName) => {
    await dispatch([cmd, "sub", "--flag"]);
    const mod = (await import(/* @vite-ignore */ modPath)) as Record<string, ReturnType<typeof vi.fn>>;
    expect(mod[fnName]).toHaveBeenCalledWith(["sub", "--flag"]);
  });

  // An unmatched first arg used to be scaffolded as a project name, so every
  // typo silently created a directory.
  it("rejects an unknown command instead of scaffolding it", async () => {
    await dispatch(["frobnicate"]);

    const { runCLI } = await import("./commands/init.js");
    expect(runCLI).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    const errors = errSpy.mock.calls.map((c) => c[0] as string).join("\n");
    expect(errors).toContain('Unknown command "frobnicate"');
    expect(errors).toContain("seamless init frobnicate");
    expect(errors).toContain("apps");
  });

  it("does not offer init as a fix for a flag-like argument", async () => {
    await dispatch(["--frobnicate"]);

    const errors = errSpy.mock.calls.map((c) => c[0] as string).join("\n");
    expect(errors).toContain('Unknown command "--frobnicate"');
    expect(errors).not.toContain("seamless init --frobnicate");
  });

  it("logs the error and exits 1 when a command rejects", async () => {
    process.argv = ["node", "index.js", "check"];
    const { runCheck } = await import("./commands/check.js");
    vi.mocked(runCheck).mockRejectedValueOnce(new Error("kaboom"));

    await import("./index.js");
    await flush();
    await flush();

    expect(errSpy).toHaveBeenCalledWith("Error:", "kaboom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // Ctrl-C is not a failure: it reports as a cancellation on stdout and uses the
  // conventional interrupt status rather than the generic error path.
  it("reports a cancellation and exits 130", async () => {
    process.argv = ["node", "index.js", "check"];
    const { runCheck } = await import("./commands/check.js");
    const { CancelledError } = await import("./core/cancel.js");
    vi.mocked(runCheck).mockRejectedValueOnce(new CancelledError());

    await import("./index.js");
    await flush();
    await flush();

    // Only positive assertions here: both rejection tests import index fresh and
    // main() settles on its own schedule, so one test's tail can still be in
    // flight while the next runs and would pollute a "never called" check.
    expect(logSpy).toHaveBeenCalledWith("Cancelled.");
    expect(exitSpy).toHaveBeenCalledWith(130);
  });

  it("exports VERSION from package.json", async () => {
    const mod = await dispatch(["--version"]);
    expect(mod.VERSION).toBe(pkg.version);
  });
});
