import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  runCLI,
  type InitDependencies,
  type ProjectSetupAnswers,
} from "../../src/commands/init.js";
import {
  captureConsole,
  cleanupTempDir,
  createTempDir,
  withCwd,
} from "../helpers/index.js";

function createAnswers(
  overrides: Partial<ProjectSetupAnswers> = {},
): ProjectSetupAnswers {
  return {
    web: true,
    webFramework: "react",
    api: true,
    apiFramework: "express",
    authMode: "source",
    useDocker: false,
    includeAdmin: true,
    adminMode: "image",
    ...overrides,
  };
}

function createInitOverrides(
  answers: ProjectSetupAnswers,
  sharedConfig = { apiToken: "token", kid: "kid-1" },
) {
  const calls: string[] = [];

  const overrides: Partial<InitDependencies> = {
    runProjectSetupPrompts: vi.fn(async () => answers),
    generateReactStarter: vi.fn(async ({ root }: { root: string }) => {
      calls.push(`web:${root}`);
    }),
    generateExpressStarter: vi.fn(async ({ root }: { root: string }) => {
      calls.push(`api:${root}`);
    }),
    generateAdminStarter: vi.fn(async ({ root }: { root: string }) => {
      calls.push(`admin:${root}`);
    }),
    generateAuthServer: vi.fn(async (_context, mode) => {
      calls.push(`auth:${String(mode)}`);
    }),
    configureAuthLocalEnv: vi.fn(async () => {
      calls.push("configure-auth-local");
      return sharedConfig;
    }),
    generateDockerCompose: vi.fn(async () => {
      calls.push("docker-compose");
      return { apiToken: "docker-token", kid: "docker-kid" };
    }),
    configureApiEnv: vi.fn(() => {
      calls.push("configure-api");
    }),
    configureWebEnv: vi.fn(() => {
      calls.push("configure-web");
    }),
    generateSeamlessConfig: vi.fn(() => {
      calls.push("config");
    }),
    printSuccessOutput: vi.fn(() => {
      calls.push("success");
    }),
  };

  return { overrides, calls };
}

describe("runCLI", () => {
  it("runs the source auth init flow using injected dependencies", async () => {
    const cwd = createTempDir();

    try {
      const answers = createAnswers();
      const { overrides, calls } = createInitOverrides(answers);

      await withCwd(cwd, () => runCLI("my-app", overrides));

      const projectRoot = path.join(cwd, "my-app");
      const realProjectRoot = fs.realpathSync(projectRoot);

      expect(fs.existsSync(projectRoot)).toBe(true);
      expect(calls).toEqual([
        `web:${realProjectRoot}`,
        `api:${realProjectRoot}`,
        "auth:source",
        "configure-auth-local",
        "configure-api",
        "configure-web",
        "config",
        "success",
      ]);

      expect(overrides.generateDockerCompose).not.toHaveBeenCalled();
      expect(overrides.configureApiEnv).toHaveBeenCalledWith(realProjectRoot, {
        apiToken: "token",
        kid: "kid-1",
      });
      expect(overrides.generateSeamlessConfig).toHaveBeenCalledWith(
        realProjectRoot,
        expect.objectContaining({
          projectName: "my-app",
          webFramework: "react",
          apiFramework: "express",
          authMode: "source",
          adminMode: "image",
        }),
      );
      expect(overrides.generateAdminStarter).not.toHaveBeenCalled();
    } finally {
      cleanupTempDir(cwd);
    }
  });

  it("clones the admin source when source mode is selected", async () => {
    const cwd = createTempDir();

    try {
      const answers = createAnswers({
        adminMode: "source",
      });
      const { overrides, calls } = createInitOverrides(answers);

      await withCwd(cwd, () => runCLI("admin-source-app", overrides));

      const projectRoot = fs.realpathSync(path.join(cwd, "admin-source-app"));

      expect(calls).toContain(`admin:${projectRoot}`);
      expect(overrides.generateAdminStarter).toHaveBeenCalledWith({
        root: projectRoot,
      });
      expect(overrides.generateDockerCompose).not.toHaveBeenCalled();
    } finally {
      cleanupTempDir(cwd);
    }
  });

  it("passes admin source mode through to docker compose generation", async () => {
    const cwd = createTempDir();

    try {
      const answers = createAnswers({
        authMode: "image",
        adminMode: "source",
        useDocker: true,
      });
      const { overrides } = createInitOverrides(answers);

      await withCwd(cwd, () => runCLI("admin-docker-app", overrides));

      const projectRoot = fs.realpathSync(path.join(cwd, "admin-docker-app"));

      expect(overrides.generateAdminStarter).toHaveBeenCalledWith({
        root: projectRoot,
      });
      expect(overrides.generateDockerCompose).toHaveBeenCalledWith(
        projectRoot,
        {
          authMode: "image",
          adminMode: "source",
          includeAdmin: true,
        },
      );
    } finally {
      cleanupTempDir(cwd);
    }
  });

  it("uses image auth shared config when image mode is enabled", async () => {
    const cwd = createTempDir();

    try {
      const answers = createAnswers({
        authMode: "image",
        useDocker: true,
      });
      const { overrides } = createInitOverrides(answers);

      await withCwd(cwd, () => runCLI("docker-app", overrides));

      const projectRoot = path.join(cwd, "docker-app");
      const realProjectRoot = fs.realpathSync(projectRoot);

      expect(overrides.generateAuthServer).not.toHaveBeenCalled();
      expect(overrides.configureAuthLocalEnv).not.toHaveBeenCalled();
      expect(overrides.generateDockerCompose).toHaveBeenCalledWith(
        realProjectRoot,
        {
          authMode: "image",
          adminMode: "image",
          includeAdmin: true,
        },
      );
      expect(overrides.configureApiEnv).toHaveBeenCalledWith(realProjectRoot, {
        apiToken: "docker-token",
        kid: "docker-kid",
      });
    } finally {
      cleanupTempDir(cwd);
    }
  });

  it("returns early for non-empty directories", async () => {
    const cwd = createTempDir();

    try {
      fs.writeFileSync(path.join(cwd, "existing.txt"), "occupied");
      const answers = createAnswers();
      const { overrides } = createInitOverrides(answers);
      const { stdout } = captureConsole();

      await withCwd(cwd, () => runCLI(undefined, overrides));

      expect(stdout).toContain("Existing project detected.");
      expect(stdout).toContain("Integration flow coming next.");
      expect(overrides.runProjectSetupPrompts).not.toHaveBeenCalled();
    } finally {
      cleanupTempDir(cwd);
    }
  });
});
