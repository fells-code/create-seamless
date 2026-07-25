import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";

import { confirm, isCancel } from "@clack/prompts";
import {
  runManagedTemplatePrompts,
  runProjectSetupPrompts,
} from "../prompts/projectSetup.js";
import { runOAuthSetupPrompts } from "../prompts/oauthSetup.js";
import { generateAuthServer } from "../generators/auth/auth.js";
import { generateDockerCompose } from "../generators/docker/docker.js";
import { generateSeamlessConfig } from "../generators/config/config.js";
import {
  printManagedSuccessOutput,
  printSuccessOutput,
} from "../core/output.js";
import {
  applyTemplateEnv,
  assertCliSupports,
  openTemplateSource,
} from "../core/templates.js";
import { createAuthClient, ReauthRequiredError } from "../core/authClient.js";
import { listApplications, rotateServiceToken } from "../core/portal.js";
import { selectApplication } from "../prompts/appSelect.js";
import { parseEnv, writeEnv } from "../core/env.js";

import { runCLI } from "./init.js";

// Defensive: templates.ts transitively imports ../index.js (which runs main() at
// import time). It is mocked below, but stub index.js too so nothing runs it.
vi.mock("../index.js", () => ({ VERSION: "0.0.0-test" }));

vi.mock("fs", () => {
  const fns = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
  };
  return { default: fns, ...fns };
});

vi.mock("@clack/prompts", () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
}));

vi.mock("../prompts/projectSetup.js", () => ({
  runManagedTemplatePrompts: vi.fn(),
  runProjectSetupPrompts: vi.fn(),
}));
vi.mock("../prompts/oauthSetup.js", () => ({
  runOAuthSetupPrompts: vi.fn(),
}));
vi.mock("../prompts/appSelect.js", () => ({
  selectApplication: vi.fn(),
}));
vi.mock("../generators/auth/auth.js", () => ({
  generateAuthServer: vi.fn(),
}));
vi.mock("../generators/docker/docker.js", () => ({
  generateDockerCompose: vi.fn(),
}));
vi.mock("../generators/config/config.js", () => ({
  generateSeamlessConfig: vi.fn(),
}));
vi.mock("../core/output.js", () => ({
  printManagedSuccessOutput: vi.fn(),
  printSuccessOutput: vi.fn(),
}));
vi.mock("../core/templates.js", () => ({
  openTemplateSource: vi.fn(),
  applyTemplateEnv: vi.fn(),
  assertCliSupports: vi.fn(),
}));
vi.mock("../core/authClient.js", () => {
  class ReauthRequiredError extends Error {}
  return { createAuthClient: vi.fn(), ReauthRequiredError };
});
vi.mock("../core/portal.js", () => ({
  listApplications: vi.fn(),
  rotateServiceToken: vi.fn(),
}));
vi.mock("../core/config.js", () => ({
  normalizeInstanceUrl: vi.fn((u: string) => `norm:${u}`),
}));
vi.mock("../core/env.js", () => ({
  parseEnv: vi.fn(() => ({})),
  writeEnv: vi.fn(),
}));
vi.mock("../core/secrets.js", () => ({
  generateSecret: vi.fn(() => "generated-secret"),
}));

const CWD = "/work";

// A registry with a web and an api template, plus a coming-soon web entry to
// exercise the alias filtering. The `oauth` alias is on a stable web template.
function registry() {
  return {
    schemaVersion: 1,
    templates: [
      {
        id: "web-oauth",
        kind: "web",
        framework: "react",
        label: "React OAuth",
        alias: "oauth",
        status: "stable",
        path: "web-oauth",
      },
      {
        id: "web-basic",
        kind: "web",
        framework: "vue",
        label: "Vue Basic",
        status: "stable",
        path: "web-basic",
      },
      {
        id: "api-express",
        kind: "api",
        framework: "express",
        label: "Express",
        alias: "express",
        status: "stable",
        path: "api-express",
      },
      {
        id: "api-soon",
        kind: "api",
        framework: "go",
        label: "Go",
        alias: "go",
        status: "coming-soon",
        path: "api-soon",
      },
    ],
  };
}

// A template source whose manifests are keyed by template id, defaulting to a
// simple manifest with a targetDir matching the kind.
function makeSource(manifests: Record<string, any> = {}) {
  const reg = registry();
  return {
    registry: reg,
    readManifest: vi.fn(async (entry: any) => {
      if (manifests[entry.id]) return manifests[entry.id];
      return {
        id: entry.id,
        targetDir: entry.kind === "web" ? "web" : "api",
      };
    }),
    copyInto: vi.fn(async () => {}),
  };
}

function app(over: Record<string, any> = {}) {
  return {
    id: "app-1",
    name: "Acme",
    domain: "https://acme.example.com",
    hasServiceToken: false,
    ...over,
  };
}

let logs: string[];

beforeEach(() => {
  vi.clearAllMocks();
  logs = [];
  vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
    logs.push(String(msg ?? ""));
  });
  vi.spyOn(process, "cwd").mockReturnValue(CWD);
  vi.mocked(isCancel).mockReturnValue(false);
  // Empty directory by default (fresh scaffold).
  vi.mocked(fs.readdirSync).mockReturnValue([] as never);
  vi.mocked(fs.existsSync).mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function out(): string {
  return logs.join("\n");
}

describe("runCLI directory handling", () => {
  it("throws when the named project directory already exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    await expect(runCLI("myapp")).rejects.toThrow(/already exists: myapp/);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("creates the project directory and logs it", async () => {
    // New named project: does not exist, then scaffold local runs.
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      useDocker: true,
    } as never);
    vi.mocked(generateDockerCompose).mockResolvedValue({
      apiToken: "tok",
      kid: "kid",
    } as never);

    await runCLI("myapp", []);

    expect(fs.mkdirSync).toHaveBeenCalledWith("/work/myapp");
    expect(out()).toContain("Creating project in /work/myapp");
  });
});

describe("resolveManagedClient", () => {
  it("falls back to the local stack when no session exists", async () => {
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      useDocker: true,
    } as never);
    vi.mocked(generateDockerCompose).mockResolvedValue({} as never);

    await runCLI();

    // Local scaffold ran (managed prompts never used).
    expect(runProjectSetupPrompts).toHaveBeenCalled();
    expect(runManagedTemplatePrompts).not.toHaveBeenCalled();
  });

  it("falls back to local (with a warning) when the control plane is unreachable", async () => {
    vi.mocked(createAuthClient).mockRejectedValue(new Error("boom"));
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      useDocker: true,
    } as never);
    vi.mocked(generateDockerCompose).mockResolvedValue({} as never);

    await runCLI();

    expect(runProjectSetupPrompts).toHaveBeenCalled();
    expect(runManagedTemplatePrompts).not.toHaveBeenCalled();
    expect(out()).toContain("Could not reach the control plane");
  });

  it("errors when --app is given but there is no session (no silent local fallback)", async () => {
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );

    await expect(runCLI(undefined, [], { appId: "app-1" })).rejects.toThrow(
      /--app was given but you are not logged in/,
    );
    expect(runProjectSetupPrompts).not.toHaveBeenCalled();
  });

  it("skips the auth client entirely with --local", async () => {
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      useDocker: true,
    } as never);
    vi.mocked(generateDockerCompose).mockResolvedValue({} as never);

    await runCLI(undefined, [], { local: true });

    expect(createAuthClient).not.toHaveBeenCalled();
    expect(runProjectSetupPrompts).toHaveBeenCalled();
  });
});

describe("scaffoldLocal", () => {
  beforeEach(() => {
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
  });

  it("wires the docker-provided shared config when auth runs in docker", async () => {
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      useDocker: true,
    } as never);
    vi.mocked(generateDockerCompose).mockResolvedValue({
      apiToken: "docker-token",
      kid: "docker-kid",
    } as never);

    await runCLI(undefined, []);

    expect(generateAuthServer).not.toHaveBeenCalled();
    expect(generateDockerCompose).toHaveBeenCalledWith("/work", {
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      oauth: [],
    });
    // env applied with the docker-provided token/kid for both templates.
    expect(applyTemplateEnv).toHaveBeenCalledTimes(2);
    expect(applyTemplateEnv).toHaveBeenLastCalledWith(
      "/work/api",
      expect.anything(),
      expect.objectContaining({
        apiToken: "docker-token",
        jwksKid: "docker-kid",
      }),
    );
    expect(generateSeamlessConfig).toHaveBeenCalledWith(
      "/work",
      expect.objectContaining({
        authMode: "docker",
        webFramework: "vue",
        apiFramework: "express",
      }),
    );
    expect(printSuccessOutput).toHaveBeenCalled();
  });

  it("runs the local auth generator and collects OAuth when the web template opts in", async () => {
    const source = makeSource({
      "web-oauth": {
        id: "web-oauth",
        targetDir: "web",
        setup: { oauth: true },
      },
    });
    vi.mocked(openTemplateSource).mockResolvedValue(source as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-oauth",
      apiTemplateId: "api-express",
      authMode: "local",
      adminMode: "image",
      includeAdmin: true,
      useDocker: false,
    } as never);
    vi.mocked(runOAuthSetupPrompts).mockResolvedValue([
      {
        catalog: { label: "Google" },
        clientId: "id",
        clientSecret: "secret",
      },
      {
        catalog: { label: "GitHub" },
        clientId: "",
        clientSecret: "",
      },
    ] as never);
    vi.mocked(generateAuthServer).mockResolvedValue({
      apiToken: "local-token",
      kid: "local-kid",
    } as never);

    await runCLI(undefined, []);

    expect(runOAuthSetupPrompts).toHaveBeenCalled();
    expect(generateAuthServer).toHaveBeenCalledWith(
      { root: "/work" },
      "local",
      expect.arrayContaining([
        expect.objectContaining({ catalog: { label: "Google" } }),
      ]),
    );
    // Docker not requested, so the compose generator is untouched.
    expect(generateDockerCompose).not.toHaveBeenCalled();
    // OAuth next-steps summary lists ready and pending providers.
    expect(out()).toContain("Enabled: Google");
    expect(out()).toContain("Needs credentials before use: GitHub");
    expect(out()).toContain("Register this redirect URI");
  });

  it("does not prompt for OAuth when the web template does not opt in", async () => {
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
      authMode: "local",
      adminMode: "image",
      includeAdmin: false,
      useDocker: false,
    } as never);
    vi.mocked(generateAuthServer).mockResolvedValue({} as never);

    await runCLI(undefined, []);

    expect(runOAuthSetupPrompts).not.toHaveBeenCalled();
    // No providers, so no OAuth summary is printed.
    expect(out()).not.toContain("OAuth providers");
  });
});

describe("template alias resolution", () => {
  beforeEach(() => {
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "web-oauth",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      useDocker: true,
    } as never);
    vi.mocked(generateDockerCompose).mockResolvedValue({} as never);
  });

  it("preselects a template from a matching alias flag", async () => {
    await runCLI(undefined, ["oauth"]);
    expect(runProjectSetupPrompts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ webTemplateId: "web-oauth" }),
    );
  });

  it("rejects an unknown alias flag", async () => {
    await expect(runCLI(undefined, ["nope"])).rejects.toThrow(
      /Unknown option "--nope"/,
    );
  });

  it("rejects a coming-soon alias flag", async () => {
    await expect(runCLI(undefined, ["go"])).rejects.toThrow(
      /Unknown option "--go"/,
    );
  });

  it("reports (none) available when no template exposes an alias", async () => {
    const src = makeSource();
    // Strip every alias so the error's available-flags list is empty.
    for (const t of src.registry.templates) delete (t as any).alias;
    vi.mocked(openTemplateSource).mockResolvedValue(src as never);

    await expect(runCLI(undefined, ["nope"])).rejects.toThrow(
      /Available template flags: \(none\)/,
    );
  });

  it("rejects conflicting web alias flags", async () => {
    // Add a second stable web alias so two web flags conflict.
    const src = makeSource();
    src.registry.templates.push({
      id: "web-other",
      kind: "web",
      framework: "svelte",
      label: "Svelte",
      alias: "svelte",
      status: "stable",
      path: "web-other",
    } as never);
    vi.mocked(openTemplateSource).mockResolvedValue(src as never);

    await expect(runCLI(undefined, ["oauth", "svelte"])).rejects.toThrow(
      /Conflicting web template flags/,
    );
  });

  it("rejects conflicting api alias flags", async () => {
    const src = makeSource();
    // Make the coming-soon go template stable so it becomes a usable api alias.
    src.registry.templates[3].status = "stable";
    vi.mocked(openTemplateSource).mockResolvedValue(src as never);

    await expect(runCLI(undefined, ["express", "go"])).rejects.toThrow(
      /Conflicting api template flags/,
    );
  });
});

describe("findEntry", () => {
  it("throws when a selected template id is not in the registry", async () => {
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runProjectSetupPrompts).mockResolvedValue({
      webTemplateId: "does-not-exist",
      apiTemplateId: "api-express",
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      useDocker: true,
    } as never);

    await expect(runCLI(undefined, [])).rejects.toThrow(
      /"does-not-exist" is not in the registry/,
    );
  });
});

describe("scaffoldManaged", () => {
  function loggedIn() {
    vi.mocked(createAuthClient).mockResolvedValue({
      profile: { name: "default", instanceUrl: "https://auth" },
    } as never);
    vi.mocked(openTemplateSource).mockResolvedValue(makeSource() as never);
    vi.mocked(runManagedTemplatePrompts).mockResolvedValue({
      webTemplateId: "web-basic",
      apiTemplateId: "api-express",
    } as never);
  }

  it("scaffolds against the selected managed application and issues a token", async () => {
    loggedIn();
    vi.mocked(listApplications).mockResolvedValue([app()] as never);
    vi.mocked(selectApplication).mockResolvedValue(app() as never);
    vi.mocked(rotateServiceToken).mockResolvedValue("svc-token");

    await runCLI(undefined, [], { appId: "app-1" });

    expect(rotateServiceToken).toHaveBeenCalledWith(
      expect.anything(),
      "app-1",
    );
    expect(applyTemplateEnv).toHaveBeenCalledTimes(2);
    expect(applyTemplateEnv).toHaveBeenCalledWith(
      "/work/api",
      expect.anything(),
      expect.objectContaining({
        apiToken: "svc-token",
        authServerUrl: "norm:https://acme.example.com",
        jwksKid: "dev-main",
      }),
    );
    expect(generateSeamlessConfig).toHaveBeenCalledWith(
      "/work",
      expect.objectContaining({
        authMode: "managed",
        adminMode: "image",
        managed: expect.objectContaining({
          applicationId: "app-1",
          applicationName: "Acme",
        }),
      }),
    );
    expect(printManagedSuccessOutput).toHaveBeenCalled();
    // No confirm needed when the app has no existing token.
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirms before rotating when the app already has a service token", async () => {
    loggedIn();
    const existing = app({ hasServiceToken: true });
    vi.mocked(listApplications).mockResolvedValue([existing] as never);
    vi.mocked(selectApplication).mockResolvedValue(existing as never);
    vi.mocked(confirm).mockResolvedValue(true as never);
    vi.mocked(rotateServiceToken).mockResolvedValue("new-token");

    await runCLI(undefined, []);

    expect(confirm).toHaveBeenCalled();
    expect(rotateServiceToken).toHaveBeenCalled();
    expect(printManagedSuccessOutput).toHaveBeenCalled();
  });

  it("copies templates before rotating the token", async () => {
    loggedIn();
    const order: string[] = [];
    const source = makeSource();
    source.copyInto = vi.fn(async () => {
      order.push("copy");
    }) as never;
    vi.mocked(openTemplateSource).mockResolvedValue(source as never);
    vi.mocked(listApplications).mockResolvedValue([app()] as never);
    vi.mocked(selectApplication).mockResolvedValue(app() as never);
    vi.mocked(rotateServiceToken).mockImplementation(async () => {
      order.push("rotate");
      return "svc-token" as never;
    });

    await runCLI(undefined, [], { appId: "app-1" });

    // copyInto (the likeliest failure) must run before the destructive rotation.
    expect(order.indexOf("copy")).toBeLessThan(order.indexOf("rotate"));
  });

  it("prints the issued token for recovery when a post-rotation step fails", async () => {
    loggedIn();
    vi.mocked(listApplications).mockResolvedValue([app()] as never);
    vi.mocked(selectApplication).mockResolvedValue(app() as never);
    vi.mocked(rotateServiceToken).mockResolvedValue("svc-token");
    vi.mocked(applyTemplateEnv).mockImplementation(() => {
      throw new Error("disk full");
    });

    await expect(runCLI(undefined, [], { appId: "app-1" })).rejects.toThrow(
      /disk full/,
    );

    // The freshly issued (and now-active) token is surfaced so the app can recover.
    expect(out()).toContain("svc-token");
    expect(printManagedSuccessOutput).not.toHaveBeenCalled();
  });

  it("aborts the scaffold when the developer declines rotation", async () => {
    loggedIn();
    const existing = app({ hasServiceToken: true });
    vi.mocked(listApplications).mockResolvedValue([existing] as never);
    vi.mocked(selectApplication).mockResolvedValue(existing as never);
    vi.mocked(confirm).mockResolvedValue(false as never);

    await runCLI(undefined, []);

    expect(rotateServiceToken).not.toHaveBeenCalled();
    expect(out()).toContain("Cancelled. No token was issued.");
    expect(printManagedSuccessOutput).not.toHaveBeenCalled();
  });

  it("aborts when the confirm prompt is cancelled", async () => {
    loggedIn();
    const existing = app({ hasServiceToken: true });
    vi.mocked(listApplications).mockResolvedValue([existing] as never);
    vi.mocked(selectApplication).mockResolvedValue(existing as never);
    vi.mocked(confirm).mockResolvedValue(Symbol("cancel") as never);
    vi.mocked(isCancel).mockReturnValue(true);

    await runCLI(undefined, []);

    expect(rotateServiceToken).not.toHaveBeenCalled();
    expect(out()).toContain("Cancelled. No token was issued.");
  });

  it("returns early when no application is selected", async () => {
    loggedIn();
    vi.mocked(listApplications).mockResolvedValue([] as never);
    vi.mocked(selectApplication).mockResolvedValue(undefined as never);

    await runCLI(undefined, []);

    expect(rotateServiceToken).not.toHaveBeenCalled();
    expect(printManagedSuccessOutput).not.toHaveBeenCalled();
  });
});

describe("integrateExistingProject", () => {
  beforeEach(() => {
    // Non-empty directory triggers the existing-project path.
    vi.mocked(fs.readdirSync).mockReturnValue(["package.json"] as never);
  });

  it("prints login guidance when there is no session", async () => {
    vi.mocked(createAuthClient).mockRejectedValue(
      new ReauthRequiredError("no session"),
    );

    await runCLI(undefined, []);

    expect(out()).toContain("Existing project detected.");
    expect(out()).toContain("seamless login");
  });

  it("updates api/.env when an api directory exists", async () => {
    vi.mocked(createAuthClient).mockResolvedValue({
      profile: { name: "default", instanceUrl: "https://auth" },
    } as never);
    vi.mocked(listApplications).mockResolvedValue([app()] as never);
    vi.mocked(selectApplication).mockResolvedValue(app() as never);
    vi.mocked(rotateServiceToken).mockResolvedValue("svc-token");
    // api dir exists, but api/.env does not (so parseEnv is skipped).
    vi.mocked(fs.existsSync).mockImplementation((p: string) =>
      String(p) === "/work/api",
    );

    await runCLI(undefined, []);

    expect(writeEnv).toHaveBeenCalledWith(
      "/work/api/.env",
      expect.objectContaining({
        AUTH_SERVER_URL: "norm:https://acme.example.com",
        API_SERVICE_TOKEN: "svc-token",
        JWKS_KID: "dev-main",
        COOKIE_SIGNING_KEY: "generated-secret",
      }),
    );
    expect(out()).toContain("Updated");
  });

  it("preserves existing api/.env values when the file is present", async () => {
    vi.mocked(createAuthClient).mockResolvedValue({
      profile: { name: "default", instanceUrl: "https://auth" },
    } as never);
    vi.mocked(listApplications).mockResolvedValue([app()] as never);
    vi.mocked(selectApplication).mockResolvedValue(app() as never);
    vi.mocked(rotateServiceToken).mockResolvedValue("svc-token");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(parseEnv).mockReturnValue({
      JWKS_KID: "custom-kid",
      COOKIE_SIGNING_KEY: "existing-key",
    } as never);

    await runCLI(undefined, []);

    expect(parseEnv).toHaveBeenCalledWith("/work/api/.env");
    expect(writeEnv).toHaveBeenCalledWith(
      "/work/api/.env",
      expect.objectContaining({
        JWKS_KID: "custom-kid",
        COOKIE_SIGNING_KEY: "existing-key",
      }),
    );
  });

  it("prints the managed values to paste when there is no api directory", async () => {
    vi.mocked(createAuthClient).mockResolvedValue({
      profile: { name: "default", instanceUrl: "https://auth" },
    } as never);
    vi.mocked(listApplications).mockResolvedValue([app()] as never);
    vi.mocked(selectApplication).mockResolvedValue(app() as never);
    vi.mocked(rotateServiceToken).mockResolvedValue("svc-token");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await runCLI(undefined, []);

    expect(writeEnv).not.toHaveBeenCalled();
    expect(out()).toContain("Managed connection values:");
    expect(out()).toContain("svc-token");
  });

  it("returns early when no application is selected", async () => {
    vi.mocked(createAuthClient).mockResolvedValue({
      profile: { name: "default", instanceUrl: "https://auth" },
    } as never);
    vi.mocked(listApplications).mockResolvedValue([] as never);
    vi.mocked(selectApplication).mockResolvedValue(undefined as never);

    await runCLI(undefined, []);

    expect(rotateServiceToken).not.toHaveBeenCalled();
    expect(writeEnv).not.toHaveBeenCalled();
  });

  it("returns early when token issuance is declined", async () => {
    vi.mocked(createAuthClient).mockResolvedValue({
      profile: { name: "default", instanceUrl: "https://auth" },
    } as never);
    const existing = app({ hasServiceToken: true });
    vi.mocked(listApplications).mockResolvedValue([existing] as never);
    vi.mocked(selectApplication).mockResolvedValue(existing as never);
    vi.mocked(confirm).mockResolvedValue(false as never);

    await runCLI(undefined, []);

    expect(rotateServiceToken).not.toHaveBeenCalled();
    expect(writeEnv).not.toHaveBeenCalled();
  });
});
