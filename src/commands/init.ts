import path from "path";
import fs from "fs";

import { confirm } from "@clack/prompts";
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
import {
  chooseExistingDirectoryAction,
  chooseScaffoldTarget,
  confirmLocalFallback,
} from "../prompts/initMode.js";
import { CancelledError, orCancel } from "../core/cancel.js";
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
  // Only ever set to a directory mkdir just created, never one that already
  // existed, so discarding it can never take a developer's own files with it.
  let created: string | null = null;

  if (projectName) {
    root = path.join(cwd, projectName);

    if (fs.existsSync(root)) {
      throw new Error(`Directory already exists: ${projectName}`);
    }

    fs.mkdirSync(root);
    created = root;
    console.log(`Creating project in ${root}`);
  }

  // Ctrl-C inside a prompt comes back as a CancelledError and unwinds through
  // the catch below, but during a download or a git clone it arrives as a real
  // signal that would otherwise end the process with the husk still on disk.
  const onInterrupt = () => {
    discard(created);
    process.exit(130);
  };
  if (created) process.on("SIGINT", onInterrupt);

  try {
    await scaffold(root, projectName, aliases, opts);
  } catch (err) {
    // Anything short of a completed scaffold leaves nothing behind, so a retry
    // is not blocked by "Directory already exists" from a half-built attempt.
    discard(created);
    throw err;
  } finally {
    if (created) process.off("SIGINT", onInterrupt);
  }
}

function discard(dir: string | null): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // The original failure is what the developer needs to see; a cleanup error
    // on top of it would only bury the cause.
  }
}

async function scaffold(
  root: string,
  projectName: string | undefined,
  aliases: string[],
  opts: InitOptions,
) {
  // --local forces the self-hosted stack without asking the control plane
  // anything.
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

  // Whether managed is even possible is settled before the first prompt, so a
  // session with nothing to connect never costs a round of questions first.
  const allApps = client ? await listApplications(client) : [];
  const apps = connectable(allApps);
  const canConnect = client !== null && apps.length > 0;

  const isEmpty = fs.readdirSync(root).length === 0;
  if (!isEmpty) {
    // --app is explicit managed intent, so it skips the question and integrates.
    const action = opts.appId
      ? "integrate"
      : await chooseExistingDirectoryAction(canConnect);
    if (action === "integrate") {
      await integrateExistingProject(root, client!, apps, opts);
      return;
    }
  }

  if (canConnect) {
    const target = opts.appId
      ? "managed"
      : await chooseScaffoldTarget(apps.length);
    if (target === "managed") {
      await scaffoldManaged(root, projectName, aliases, client!, apps, opts);
      return;
    }
  } else if (client) {
    console.log(kleur.yellow(noConnectableMessage(allApps.length > 0)));
  } else if (fallbackReason === "unreachable") {
    await confirmLocalFallback();
  } else if (fallbackReason === "no-session") {
    console.log(
      kleur.yellow(
        "Not logged in; scaffolding a local project. Run `seamless login` first to connect a managed instance.",
      ),
    );
  }

  await scaffoldLocal(root, projectName, aliases);
}

// The old message told an account whose only application was still provisioning
// that it had none and should create one.
function noConnectableMessage(hasProvisioning: boolean): string {
  return hasProvisioning
    ? "Your managed applications are still provisioning, so there is nothing to connect to yet. Scaffolding a local project instead."
    : "Your account has no managed applications yet (create one at https://dashboard.seamlessauth.com). Scaffolding a local project instead.";
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
  apps: ConnectableApp[],
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
  const app = await selectApplication(apps, opts.appId);

  // Copy templates before rotating the service token. Rotation invalidates the
  // app's previous token (see rotateServiceToken), so it runs as late as possible;
  // copyInto is the likeliest step to fail, so it happens first, before rotation.
  for (const { entry, dir } of selected) {
    console.log(`Adding ${entry.label} starter...`);
    await source.copyInto(entry, dir);
  }

  const serviceToken = await issueServiceToken(client, app);

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
  client: AuthClient,
  apps: ConnectableApp[],
  opts: InitOptions,
) {
  const app = await selectApplication(apps, opts.appId);

  const serviceToken = await issueServiceToken(client, app);

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
// scaffold does not silently break an app that is already deployed. Declining
// cancels the whole command, so nothing is left half-wired.
async function issueServiceToken(
  client: AuthClient,
  app: PortalApp,
): Promise<string> {
  if (app.hasServiceToken) {
    const proceed = orCancel(
      await confirm({
        message: `"${app.name}" already has a service token. Issuing a new one invalidates the existing token. Continue?`,
        initialValue: false,
      }),
    );
    if (!proceed) {
      throw new CancelledError("Cancelled. No token was issued.");
    }
  }
  return rotateServiceToken(client, app.id);
}

type ConnectableApp = PortalApp & { domain: string };

// listApplications reports applications that have not finished provisioning too,
// because `seamless apps list` has to show them. Managed connect needs an auth
// server to point at, so it keeps considering only the ones that have one.
function connectable(apps: PortalApp[]): ConnectableApp[] {
  return apps.filter((app): app is ConnectableApp => !!app.domain);
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
