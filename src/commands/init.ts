import path from "path";
import fs from "fs";

import { runProjectSetupPrompts } from "../prompts/projectSetup.js";
import { generateAuthServer } from "../generators/auth/auth.js";
import { generateDockerCompose } from "../generators/docker/docker.js";
import { printSuccessOutput } from "../core/output.js";
import { generateSeamlessConfig } from "../generators/config/config.js";
import {
  applyTemplateEnv,
  assertCliSupports,
  openTemplateSource,
  type RegistryEntry,
  type TemplateManifest,
} from "../core/templates.js";

const AUTH_SERVER_URL = "http://localhost:5312";
const API_URL = "http://localhost:3000";

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

  const source = await openTemplateSource();
  const answers = await runProjectSetupPrompts(source.registry.templates);

  const findEntry = (id: string): RegistryEntry => {
    const entry = source.registry.templates.find((t) => t.id === id);
    if (!entry) {
      throw new Error(`Selected template "${id}" is not in the registry.`);
    }
    return entry;
  };

  // Resolve the chosen templates, then place their files. Env wiring waits until the
  // shared auth config (tokens, key id) exists below.
  const selected: { entry: RegistryEntry; manifest: TemplateManifest; dir: string }[] =
    [];
  for (const id of [answers.webTemplateId, answers.apiTemplateId]) {
    const entry = findEntry(id);
    const manifest = await source.readManifest(entry);
    assertCliSupports(manifest, entry.label);
    const dir = path.join(root, manifest.targetDir);

    console.log(`Adding ${entry.label} starter...`);
    await source.copyInto(entry, dir);
    selected.push({ entry, manifest, dir });
  }

  let sharedConfig: any = {};

  if (answers.authMode === "local") {
    sharedConfig = await generateAuthServer({ root }, "local");
  }

  if (answers.useDocker) {
    const dockerShared = await generateDockerCompose(root, {
      authMode: answers.authMode,
      adminMode: answers.adminMode,
      includeAdmin: answers.includeAdmin,
    });

    if (answers.authMode === "docker") {
      sharedConfig = dockerShared;
    }
  }

  const ctx = {
    authServerUrl: AUTH_SERVER_URL,
    apiUrl: API_URL,
    apiToken: sharedConfig.apiToken,
    jwksKid: sharedConfig.kid,
  };

  for (const { manifest, dir } of selected) {
    applyTemplateEnv(dir, manifest, ctx);
  }

  const webEntry = findEntry(answers.webTemplateId);
  const apiEntry = findEntry(answers.apiTemplateId);

  generateSeamlessConfig(root, {
    projectName,
    webFramework: webEntry.framework,
    apiFramework: apiEntry.framework,
    authMode: answers.authMode,
    adminMode: answers.adminMode,
  });

  printSuccessOutput({
    projectName,
    root,
    webFramework: webEntry.framework,
    apiFramework: apiEntry.framework,
    authMode: answers.authMode,
    useDocker: answers.useDocker,
  });
}
