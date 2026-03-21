import path from "path";
import fs from "fs";
import { runProjectSetupPrompts } from "../prompts/projectSetup.js";
import { generateReactStarter } from "../generators/frontend/react.js";
import { generateExpressStarter } from "../generators/backend/express.js";
import { generateAuthServer } from "../generators/auth/auth.js";
import { configureApiEnv, configureWebEnv } from "../core/configure.js";
import {
  configureAuthLocalEnv,
  extractSharedFromExistingEnv,
  generateDockerCompose,
} from "../generators/docker/docker.js";
import { printSuccessOutput } from "../core/output.js";

export async function runCLI(projectName?: string) {
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

  const answers = await runProjectSetupPrompts();

  if (answers.web && answers.webFramework === "react") {
    await generateReactStarter({ root });
  }

  if (answers.api && answers.apiFramework === "express") {
    await generateExpressStarter({ root });
  }

  let sharedConfig: any = {};

  if (answers.authMode === "local") {
    await generateAuthServer({ root }, "local");

    sharedConfig = await configureAuthLocalEnv(root);
  }

  if (answers.useDocker) {
    const dockerShared = await generateDockerCompose(root, {
      authMode: answers.authMode,
      includeApi: answers.api,
      includeWeb: answers.web,
    });

    if (answers.authMode === "docker") {
      sharedConfig = dockerShared;
    }
  }

  if (answers.api) {
    configureApiEnv(root, sharedConfig);
  }

  if (answers.web) {
    configureWebEnv(root);
  }

  printSuccessOutput({
    projectName,
    root,
    webFramework: answers.webFramework,
    apiFramework: answers.apiFramework,
    authMode: answers.authMode,
    useDocker: answers.useDocker,
  });
}
