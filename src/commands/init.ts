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
import { runOAuthSetupPrompts } from "../prompts/oauthSetup.js";
import type { CollectedOAuthProvider } from "../core/oauthProviders.js";

const AUTH_SERVER_URL = "http://localhost:5312";
const API_URL = "http://localhost:3000";

export async function runCLI(projectName?: string, aliases: string[] = []) {
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
  const preselect = resolveTemplateAliases(aliases, source.registry.templates);
  const answers = await runProjectSetupPrompts(source.registry.templates, preselect);

  const findEntry = (id: string): RegistryEntry => {
    const entry = source.registry.templates.find((t) => t.id === id);
    if (!entry) {
      throw new Error(`Selected template "${id}" is not in the registry.`);
    }
    return entry;
  };

  // Resolve the chosen templates (read manifests) before writing anything, so every
  // prompt finishes before files are placed. Env wiring waits until the shared auth
  // config (tokens, key id) exists below.
  const selected: { entry: RegistryEntry; manifest: TemplateManifest; dir: string }[] =
    [];
  for (const id of [answers.webTemplateId, answers.apiTemplateId]) {
    const entry = findEntry(id);
    const manifest = await source.readManifest(entry);
    assertCliSupports(manifest, entry.label);
    const dir = path.join(root, manifest.targetDir);
    selected.push({ entry, manifest, dir });
  }

  // Templates can opt into OAuth setup (manifest setup.oauth). Collect providers now,
  // before scaffolding, so the auth server can be wired up with them below.
  const webSelection = selected.find((s) => s.entry.kind === "web");
  let oauthProviders: CollectedOAuthProvider[] = [];
  if (webSelection?.manifest.setup?.oauth) {
    oauthProviders = await runOAuthSetupPrompts();
  }

  for (const { entry, dir } of selected) {
    console.log(`Adding ${entry.label} starter...`);
    await source.copyInto(entry, dir);
  }

  let sharedConfig: any = {};

  if (answers.authMode === "local") {
    sharedConfig = await generateAuthServer({ root }, "local", oauthProviders);
  }

  if (answers.useDocker) {
    const dockerShared = await generateDockerCompose(root, {
      authMode: answers.authMode,
      adminMode: answers.adminMode,
      includeAdmin: answers.includeAdmin,
      oauth: oauthProviders,
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

  printOAuthNextSteps(oauthProviders);
}

// Summarizes the OAuth wiring after scaffolding: which providers are ready and which
// still need credentials, plus the redirect URI to register with each provider.
function printOAuthNextSteps(providers: CollectedOAuthProvider[]) {
  if (providers.length === 0) return;

  const ready = providers
    .filter((p) => p.clientId && p.clientSecret)
    .map((p) => p.catalog.label);
  const pending = providers
    .filter((p) => !p.clientId || !p.clientSecret)
    .map((p) => p.catalog.label);

  console.log("\nOAuth providers");
  if (ready.length) {
    console.log(`  Enabled: ${ready.join(", ")}`);
  }
  if (pending.length) {
    console.log(`  Needs credentials before use: ${pending.join(", ")}`);
    console.log(
      "  Add the client id/secret in the auth environment (OAUTH_PROVIDERS and the",
    );
    console.log('  matching *_CLIENT_SECRET), then set that provider\'s "enabled" to true.');
  }
  console.log(
    "  Register this redirect URI with each provider: http://localhost:5173/oauth/callback",
  );
}

export interface TemplatePreselect {
  webTemplateId?: string;
  apiTemplateId?: string;
}

// Resolves `--<alias>` flags (e.g. --oauth) to specific templates from the registry,
// so a matching layer's prompt can be skipped. Aliases live in the registry, so no
// per-flag code is needed here. Unknown or conflicting flags are hard errors.
function resolveTemplateAliases(
  aliases: string[],
  templates: RegistryEntry[],
): TemplatePreselect {
  const preselect: TemplatePreselect = {};

  for (const alias of aliases) {
    const entry = templates.find(
      (t) => t.alias === alias && t.status !== "coming-soon",
    );
    if (!entry) {
      const available = templates
        .filter((t) => t.alias && t.status !== "coming-soon")
        .map((t) => `--${t.alias}`)
        .join(", ");
      throw new Error(
        `Unknown option "--${alias}". Available template flags: ${available || "(none)"}.`,
      );
    }

    if (entry.kind === "web") {
      if (preselect.webTemplateId && preselect.webTemplateId !== entry.id) {
        throw new Error(
          `Conflicting web template flags: --${alias} cannot combine with another web example.`,
        );
      }
      preselect.webTemplateId = entry.id;
    } else if (entry.kind === "api") {
      if (preselect.apiTemplateId && preselect.apiTemplateId !== entry.id) {
        throw new Error(
          `Conflicting api template flags: --${alias} cannot combine with another api example.`,
        );
      }
      preselect.apiTemplateId = entry.id;
    }
  }

  return preselect;
}
