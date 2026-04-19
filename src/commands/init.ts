import path from "path";
import fs from "fs";
import { runProjectSetupPrompts } from "../prompts/projectSetup.js";
import { generateReactStarter } from "../generators/frontend/react.js";
import { generateExpressStarter } from "../generators/backend/express.js";
import { generateAuthServer } from "../generators/auth/auth.js";
import { configureApiEnv, configureWebEnv } from "../core/configure.js";
import {
  configureAuthLocalEnv,
  generateDockerCompose,
} from "../generators/docker/docker.js";
import { printSuccessOutput } from "../core/output.js";
import { generateSeamlessConfig } from "../generators/config/config.js";

export type ProjectSetupAnswers = {
  web: boolean;
  webFramework: string | null;
  api: boolean;
  apiFramework: string | null;
  authMode: "local" | "docker";
  useDocker: boolean | symbol;
  includeAdmin: boolean | symbol;
  adminMode: "image" | "source";
};

export type SharedConfig = {
  apiToken?: string;
  kid?: string;
  bootstrapSecret?: string;
};

export type InitDependencies = {
  runProjectSetupPrompts: () => Promise<ProjectSetupAnswers>;
  generateReactStarter: (context: { root: string }) => Promise<void>;
  generateExpressStarter: (context: { root: string }) => Promise<void>;
  generateAuthServer: (
    context: { root: string },
    mode: "local" | "docker" | Symbol,
  ) => Promise<void>;
  configureAuthLocalEnv: (root: string) => Promise<SharedConfig>;
  generateDockerCompose: (
    root: string,
    options: {
      authMode: "local" | "docker";
      adminMode: "image" | "source";
      includeAdmin: boolean | symbol;
    },
  ) => Promise<SharedConfig>;
  configureApiEnv: (root: string, shared: SharedConfig) => void;
  configureWebEnv: (root: string) => void;
  generateSeamlessConfig: (
    root: string,
    options: {
      projectName?: string;
      webFramework: string;
      apiFramework: string;
      authMode: "local" | "docker";
      adminMode: "image" | "source";
    },
  ) => void;
  printSuccessOutput: (config: {
    projectName?: string;
    root: string;
    webFramework: string | null;
    apiFramework: string | null;
    authMode: "local" | "docker";
    useDocker: boolean | symbol;
  }) => void;
};

const defaultDependencies: InitDependencies = {
  runProjectSetupPrompts,
  generateReactStarter,
  generateExpressStarter,
  generateAuthServer,
  configureAuthLocalEnv,
  generateDockerCompose,
  configureApiEnv,
  configureWebEnv,
  generateSeamlessConfig,
  printSuccessOutput,
};

export async function runCLI(
  projectName?: string,
  overrides: Partial<InitDependencies> = {},
) {
  const deps = { ...defaultDependencies, ...overrides };
  const cwd = process.cwd();

  let root = cwd;

  if (projectName) {
    root = path.join(cwd, projectName);

    if (fs.existsSync(root)) {
      throw new Error(`Directory already exists: ${projectName}`);
    }

    fs.mkdirSync(root);
    console.log(`Creating project in ${root}`);
  }

  const files = fs.readdirSync(root);

  const isEmpty = files.length === 0;

  if (!isEmpty) {
    console.log("Existing project detected.");
    console.log("Integration flow coming next.");
    return;
  }

  const answers = await deps.runProjectSetupPrompts();

  if (answers.web && answers.webFramework === "react") {
    await deps.generateReactStarter({ root });
  }

  if (answers.api && answers.apiFramework === "express") {
    await deps.generateExpressStarter({ root });
  }

  let sharedConfig: SharedConfig = {};

  if (answers.authMode === "local") {
    await deps.generateAuthServer({ root }, "local");

    sharedConfig = await deps.configureAuthLocalEnv(root);
  }

  if (answers.useDocker) {
    const dockerShared = await deps.generateDockerCompose(root, {
      authMode: answers.authMode,
      adminMode: answers.adminMode,
      includeAdmin: answers.includeAdmin,
    });

    if (answers.authMode === "docker") {
      sharedConfig = dockerShared;
    }
  }

  if (answers.api) {
    deps.configureApiEnv(root, sharedConfig);
  }

  if (answers.web) {
    deps.configureWebEnv(root);
  }

  deps.generateSeamlessConfig(root, {
    projectName,
    webFramework: answers.webFramework ?? "",
    apiFramework: answers.apiFramework ?? "",
    authMode: answers.authMode,
    adminMode: answers.adminMode,
  });

  deps.printSuccessOutput({
    projectName,
    root,
    webFramework: answers.webFramework,
    apiFramework: answers.apiFramework,
    authMode: answers.authMode,
    useDocker: answers.useDocker,
  });
}
