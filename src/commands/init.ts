import path from "path";
import fs from "fs";

import { confirm, isCancel } from "@clack/prompts";
import kleur from "kleur";

import {
  runProjectSetupPrompts,
  runManagedTemplatePrompts,
} from "../prompts/projectSetup.js";
import { generateAuthServer } from "../generators/auth/auth.js";
import { generateDockerCompose } from "../generators/docker/docker.js";
import {
  printManagedSuccessOutput,
  printSuccessOutput,
} from "../core/output.js";
import { generateSeamlessConfig } from "../generators/config/config.js";
import {
  applyTemplateEnv,
  assertCliSupports,
  openTemplateSource,
  type RegistryEntry,
  type ScaffoldContext,
  type TemplateManifest,
  type TemplateSource,
} from "../core/templates.js";
import { runOAuthSetupPrompts } from "../prompts/oauthSetup.js";
import type { CollectedOAuthProvider } from "../core/oauthProviders.js";
import {
  createPortalClient,
  ReauthRequiredError,
  type AuthClient,
} from "../core/authClient.js";
import { normalizeInstanceUrl } from "../core/config.js";
import { parseEnv, writeEnv } from "../core/env.js";
import { generateSecret } from "../core/secrets.js";
import {
  listApplications,
  rotateServiceToken,
  type PortalApp,
} from "../core/portal.js";
import { selectApplication } from "../prompts/appSelect.js";

const AUTH_SERVER_URL = "http://localhost:5312";
const API_URL = "http://localhost:3000";

// Managed auth instances resolve signing keys from the token header and do not
// expose a per-application JWKS kid, so the scaffolded backend uses the SDK's
// default. This matches the portal's own "Get connected" guidance.
const MANAGED_JWKS_KID = "dev-main";

export interface InitOptions {
  profileFlag?: string;
  appId?: string;
  local?: boolean;
}

export async function runCLI(
  projectName?: string,
  aliases: string[] = [],
  opts: InitOptions = {},
) {
  const cwd = process.cwd();

  // Managed connect now reads the portal session, so a profile no longer selects
  // anything here. Warn rather than silently ignoring it.
  // TODO(#125): drop the flag one minor version after release.
  if (opts.profileFlag) {
    console.log(
      kleur.yellow(
        "init no longer takes --profile; managed connect uses your portal session. Run: seamless login",
      ),
    );
  }

  let root = cwd;

  if (projectName) {
    root = path.join(cwd, projectName);

    if (fs.existsSync(root)) {
      throw new Error(`Directory already exists: ${projectName}`);
    }

    fs.mkdirSync(root);
    console.log(`Creating project in ${root}`);
  }

  // A portal session makes the managed path the default; --local forces the
  // self-hosted stack. A missing session or an unreachable control plane falls
  // back to local, unless managed was requested explicitly (handled below).
  let client: AuthClient | null = null;
  let fallbackReason: "no-session" | "unreachable" | null = null;
  if (!opts.local) {
    const resolution = await resolveManagedClient();
    client = resolution.client;
    if (!client) fallbackReason = resolution.reason;
  }

  // `--app` is an explicit managed intent. Silently scaffolding local and ignoring
  // the flag would be surprising, so fail with an actionable message instead.
  if (!client && opts.appId) {
    throw new Error(
      fallbackReason === "unreachable"
        ? "Could not reach the Seamless control plane to connect a managed instance. Check your connection, or re-run with --local to scaffold a self-hosted stack."
        : "--app was given but you are not logged in. Run `seamless login` to connect a managed instance, or drop --app to scaffold a local project.",
    );
  }

  const isEmpty = fs.readdirSync(root).length === 0;

  if (!isEmpty) {
    await integrateExistingProject(root, client, opts);
    return;
  }

  if (client) {
    await scaffoldManaged(root, projectName, aliases, client, opts);
  } else {
    if (fallbackReason) {
      console.log(
        kleur.yellow(
          fallbackReason === "unreachable"
            ? "Could not reach the control plane; scaffolding a local project instead. Use --local to skip this check."
            : "Not logged in; scaffolding a local project. Run `seamless login` first to connect a managed instance.",
        ),
      );
    }
    await scaffoldLocal(root, projectName, aliases);
  }
}

type ManagedResolution =
  | { client: AuthClient; reason: null }
  | { client: null; reason: "no-session" | "unreachable" };

// Resolves an authenticated control-plane client from the portal session. A
// missing session ("no-session") and an unreachable/errored control plane
// ("unreachable") both yield a null client so init can fall back to local (or,
// with --app, error). Instance profiles are deliberately not consulted: a session
// for an auth instance the developer administers says nothing about whether they
// have a managed account, and sending its token to the control plane would fail.
async function resolveManagedClient(): Promise<ManagedResolution> {
  try {
    return { client: await createPortalClient(), reason: null };
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      return { client: null, reason: "no-session" };
    }
    return { client: null, reason: "unreachable" };
  }
}

async function scaffoldManaged(
  root: string,
  projectName: string | undefined,
  aliases: string[],
  client: AuthClient,
  opts: InitOptions,
) {
  const source = await openTemplateSource();
  const preselect = resolveTemplateAliases(aliases, source.registry.templates);
  const answers = await runManagedTemplatePrompts(
    source.registry.templates,
    preselect,
  );

  const selected = await resolveSelectedTemplates(
    source,
    answers.webTemplateId,
    answers.apiTemplateId,
    root,
  );

  // Resolve the target application before writing files, so a cancelled selection
  // or an authorization failure leaves nothing behind.
  const apps = await listApplications(client);
  const app = await selectApplication(apps, opts.appId);
  if (!app) return;

  // Copy templates before rotating the service token. Rotation invalidates the
  // app's previous token (see rotateServiceToken), so it runs as late as possible;
  // copyInto is the likeliest step to fail, so it happens first, before rotation.
  for (const { entry, dir } of selected) {
    console.log(`Adding ${entry.label} starter...`);
    await source.copyInto(entry, dir);
  }

  const serviceToken = await issueServiceToken(client, app);
  if (serviceToken === null) return;

  const authServerUrl = normalizeInstanceUrl(app.domain);

  // Everything past rotation is guarded: if it throws, the freshly issued token is
  // printed so a deployed app can be re-wired rather than left bricked (the control
  // plane never re-shows it).
  try {
    const ctx: ScaffoldContext = {
      authServerUrl,
      apiUrl: API_URL,
      apiToken: serviceToken,
      jwksKid: MANAGED_JWKS_KID,
      // A managed instance hosts its own dashboard, so the app API does not proxy
      // the console. Keeps the template's SERVE_ADMIN_CONSOLE gate off.
      serveAdminConsole: "false",
    };

    for (const { manifest, dir } of selected) {
      applyTemplateEnv(dir, manifest, ctx);
    }

    const webEntry = findEntry(source.registry.templates, answers.webTemplateId);
    const apiEntry = findEntry(source.registry.templates, answers.apiTemplateId);

    generateSeamlessConfig(root, {
      projectName,
      webFramework: webEntry.framework,
      apiFramework: apiEntry.framework,
      authMode: "managed",
      adminMode: "image",
      managed: {
        instanceUrl: authServerUrl,
        applicationId: app.id,
        applicationName: app.name,
      },
    });

    printManagedSuccessOutput({
      projectName,
      webFramework: webEntry.framework,
      apiFramework: apiEntry.framework,
      authServerUrl,
      appName: app.name,
    });
  } catch (err) {
    console.error(
      kleur.red(
        "\nScaffolding failed after a new service token was issued. The token below is valid — set it on your backend to recover:",
      ),
    );
    printManagedValues(authServerUrl, serviceToken);
    throw err;
  }
}

async function scaffoldLocal(
  root: string,
  projectName: string | undefined,
  aliases: string[],
) {
  const source = await openTemplateSource();
  const preselect = resolveTemplateAliases(aliases, source.registry.templates);
  const answers = await runProjectSetupPrompts(
    source.registry.templates,
    preselect,
  );

  const selected = await resolveSelectedTemplates(
    source,
    answers.webTemplateId,
    answers.apiTemplateId,
    root,
  );

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
    sharedConfig = await generateAuthServer(
      { root },
      "local",
      oauthProviders,
      answers.adminMode,
    );
  }

  if (answers.useDocker) {
    const dockerShared = await generateDockerCompose(root, {
      authMode: answers.authMode,
      adminMode: answers.adminMode,
      oauth: oauthProviders,
    });

    if (answers.authMode === "docker") {
      sharedConfig = dockerShared;
    }
  }

  const ctx: ScaffoldContext = {
    authServerUrl: AUTH_SERVER_URL,
    apiUrl: API_URL,
    apiToken: sharedConfig.apiToken,
    jwksKid: sharedConfig.kid,
    serveAdminConsole: answers.adminMode === "api" ? "true" : "false",
  };

  for (const { manifest, dir } of selected) {
    applyTemplateEnv(dir, manifest, ctx);
  }

  const webEntry = findEntry(source.registry.templates, answers.webTemplateId);
  const apiEntry = findEntry(source.registry.templates, answers.apiTemplateId);

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
    adminMode: answers.adminMode,
  });

  printOAuthNextSteps(oauthProviders);
}

// Existing-project integration: wire the managed credentials into an already
// scaffolded repo without re-generating source. Kept intentionally small, it
// updates api/.env when an api directory exists and otherwise prints the values
// to paste in by hand.
async function integrateExistingProject(
  root: string,
  client: AuthClient | null,
  opts: InitOptions,
) {
  if (!client) {
    console.log("Existing project detected.");
    console.log(
      "Log in first to connect it to a managed instance: " +
        kleur.cyan("seamless login") +
        ".",
    );
    console.log(
      kleur.dim(
        "Run init in an empty directory to scaffold a new local project.",
      ),
    );
    return;
  }

  const apps = await listApplications(client);
  const app = await selectApplication(apps, opts.appId);
  if (!app) return;

  const serviceToken = await issueServiceToken(client, app);
  if (serviceToken === null) return;

  const authServerUrl = normalizeInstanceUrl(app.domain);
  const apiDir = path.join(root, "api");

  if (!fs.existsSync(apiDir)) {
    printManagedValues(authServerUrl, serviceToken);
    return;
  }

  // The token is already rotated (old one invalidated); if the write fails, print
  // it so the app can be re-wired by hand rather than left bricked.
  try {
    wireApiEnv(apiDir, authServerUrl, serviceToken);
  } catch (err) {
    console.error(
      kleur.red(
        "\nFailed to write api/.env after issuing a new service token. Set it by hand to recover:",
      ),
    );
    printManagedValues(authServerUrl, serviceToken);
    throw err;
  }

  console.log(kleur.green(`Updated ${path.join("api", ".env")}.`));
  console.log(
    kleur.dim("  Set your web app's auth server URL to: ") +
      kleur.cyan(authServerUrl),
  );
}

// Merges the managed auth values into an existing api/.env, preserving any keys
// already there and keeping (or generating) a cookie signing key.
function wireApiEnv(
  apiDir: string,
  authServerUrl: string,
  serviceToken: string,
) {
  const envPath = path.join(apiDir, ".env");
  const values = fs.existsSync(envPath) ? parseEnv(envPath) : {};

  values.AUTH_SERVER_URL = authServerUrl;
  values.API_SERVICE_TOKEN = serviceToken;
  values.JWKS_KID = values.JWKS_KID || MANAGED_JWKS_KID;
  values.COOKIE_SIGNING_KEY =
    values.COOKIE_SIGNING_KEY || generateSecret(32);

  fs.mkdirSync(apiDir, { recursive: true });
  writeEnv(envPath, values);
}

function printManagedValues(authServerUrl: string, serviceToken: string) {
  console.log(kleur.green("\nManaged connection values:\n"));
  console.log(kleur.dim("  AUTH_SERVER_URL   ") + authServerUrl);
  console.log(kleur.dim("  API_SERVICE_TOKEN ") + serviceToken);
  console.log(kleur.dim("  JWKS_KID          ") + MANAGED_JWKS_KID);
  console.log(
    kleur.yellow(
      "\nCopy the service token now. The control plane will not show it again.",
    ),
  );
  console.log(
    kleur.dim(
      "Set AUTH_SERVER_URL and API_SERVICE_TOKEN on your backend, and the auth",
    ),
  );
  console.log(
    kleur.dim("server URL on your frontend, then sign in to verify.\n"),
  );
}

// Issues the app's service token, confirming first when one already exists so a
// scaffold does not silently break an app that is already deployed. Returns null
// only when the developer declines the rotation.
async function issueServiceToken(
  client: AuthClient,
  app: PortalApp,
): Promise<string | null> {
  if (app.hasServiceToken) {
    const proceed = await confirm({
      message: `"${app.name}" already has a service token. Issuing a new one invalidates the existing token. Continue?`,
      initialValue: false,
    });
    if (isCancel(proceed) || !proceed) {
      console.log("Cancelled. No token was issued.");
      return null;
    }
  }
  return rotateServiceToken(client, app.id);
}

interface SelectedTemplate {
  entry: RegistryEntry;
  manifest: TemplateManifest;
  dir: string;
}

// Resolves the chosen templates (reading their manifests and asserting CLI
// support) before any files are written, so every prompt finishes first.
async function resolveSelectedTemplates(
  source: TemplateSource,
  webTemplateId: string,
  apiTemplateId: string,
  root: string,
): Promise<SelectedTemplate[]> {
  const selected: SelectedTemplate[] = [];
  for (const id of [webTemplateId, apiTemplateId]) {
    const entry = findEntry(source.registry.templates, id);
    const manifest = await source.readManifest(entry);
    assertCliSupports(manifest, entry.label);
    const dir = path.join(root, manifest.targetDir);
    selected.push({ entry, manifest, dir });
  }
  return selected;
}

function findEntry(templates: RegistryEntry[], id: string): RegistryEntry {
  const entry = templates.find((t) => t.id === id);
  if (!entry) {
    throw new Error(`Selected template "${id}" is not in the registry.`);
  }
  return entry;
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
