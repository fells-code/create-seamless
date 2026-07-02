import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import kleur from "kleur";

import { runCommand } from "../core/exec.js";
import type { Registry } from "../core/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const VERIFY_DIR = path.join(REPO_ROOT, "verify");
const COMPOSE_FILE = path.join(VERIFY_DIR, "docker-compose.verify.yml");
const HARNESS_DIR = path.join(VERIFY_DIR, "harness");

interface VerifyOptions {
  local: boolean;
  keepUp: boolean;
  apiOnly: boolean;
  react: boolean;
  grep?: string;
}

function parseArgs(args: string[]): VerifyOptions {
  const apiOnly = args.includes("--api-only");
  return {
    local: args.includes("--local"),
    keepUp: args.includes("--keep-up"),
    apiOnly,
    // The browser layer runs by default; --no-react (or --api-only) skips it.
    react: !apiOnly && !args.includes("--no-react"),
    grep: args.find((a) => a.startsWith("--filter="))?.split("=")[1],
  };
}

function ensureDocker(): void {
  try {
    execSync("docker --version", { stdio: "ignore" });
  } catch {
    throw new Error(
      "Docker is required for `seamless verify`. Install: https://docs.docker.com/get-docker/",
    );
  }
}

// The auth API is built from local source. Defaults to a sibling checkout so a
// linked CLI works without extra config; override with SEAMLESS_API_DIR.
function resolveApiDir(): string {
  const candidate =
    process.env.SEAMLESS_API_DIR ?? path.resolve(REPO_ROOT, "..", "seamless-auth-api");
  if (!fs.existsSync(path.join(candidate, "package.json"))) {
    throw new Error(
      `Could not find the seamless-auth-api source at ${candidate}.\n` +
        "  Set SEAMLESS_API_DIR to its local checkout.",
    );
  }
  return candidate;
}

// The seamless-templates checkout the web template is resolved from. Defaults to a
// sibling checkout; override with SEAMLESS_TEMPLATES_DIR.
function resolveTemplatesRoot(): string {
  return (
    process.env.SEAMLESS_TEMPLATES_DIR ??
    path.resolve(REPO_ROOT, "..", "seamless-templates")
  );
}

// The web template served at :5173 and pointed at the adapter. Only needed for browser
// runs. Resolution order: an explicit SEAMLESS_REACT_DIR (a direct template path, used by
// CI), otherwise the web template discovered from the registry.
// TODO(#1b): run the browser suite against every web template in the registry, not just
// the first one, once templates can each declare how they build and serve.
function resolveReactDir(): string {
  const override = process.env.SEAMLESS_REACT_DIR;
  if (override) {
    if (!fs.existsSync(path.join(override, "package.json"))) {
      throw new Error(`SEAMLESS_REACT_DIR=${override} has no package.json.`);
    }
    return override;
  }

  const root = resolveTemplatesRoot();
  const registryPath = path.join(root, "registry.json");
  if (!fs.existsSync(registryPath)) {
    throw new Error(
      `Could not find the templates registry at ${registryPath}.\n` +
        "  Set SEAMLESS_TEMPLATES_DIR (or SEAMLESS_REACT_DIR to a template path), or run with --no-react.",
    );
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as Registry;
  const webTemplates = (registry.templates ?? []).filter(
    (t) => t.kind === "web" && t.status !== "coming-soon",
  );
  if (webTemplates.length === 0) {
    throw new Error("The templates registry has no runnable web templates.");
  }

  const chosen = webTemplates[0];
  if (webTemplates.length > 1) {
    console.log(
      kleur.yellow(
        `Note: the registry has ${webTemplates.length} web templates; verify currently runs only "${chosen.id}" (multi-template verify is pending, #1b).`,
      ),
    );
  }

  const dir = path.resolve(root, chosen.path);
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    throw new Error(
      `Web template "${chosen.id}" resolved to ${dir}, which has no package.json.`,
    );
  }
  return dir;
}

const VENDOR_DIR = path.join(VERIFY_DIR, "adapter-app", "vendor");
const REACT_VENDOR_DIR = path.join(VERIFY_DIR, "react-vendor");

// The React client SDK (@seamless-auth/react). Defaults to a sibling checkout;
// override with SEAMLESS_REACT_SDK_DIR. Only needed for --local browser runs.
function resolveReactSdkDir(): string {
  const candidate =
    process.env.SEAMLESS_REACT_SDK_DIR ??
    path.resolve(REPO_ROOT, "..", "seamless-auth-react");
  if (!fs.existsSync(path.join(candidate, "package.json"))) {
    throw new Error(
      `Could not find @seamless-auth/react at ${candidate}.\n` +
        "  Set SEAMLESS_REACT_SDK_DIR to its local checkout (needed for --local browser runs).",
    );
  }
  return candidate;
}

// The local server SDK (@seamless-auth/core + /express). Defaults to a sibling
// checkout; override with SEAMLESS_SERVER_DIR. Only needed for --local.
function resolveServerDir(): string {
  const candidate =
    process.env.SEAMLESS_SERVER_DIR ?? path.resolve(REPO_ROOT, "..", "seamless-auth-server");
  if (!fs.existsSync(path.join(candidate, "pnpm-workspace.yaml"))) {
    throw new Error(
      `Could not find seamless-auth-server at ${candidate}.\n` +
        "  Set SEAMLESS_SERVER_DIR to its local checkout (needed for --local).",
    );
  }
  return candidate;
}

function cleanVendor(): void {
  for (const dir of [VENDOR_DIR, REACT_VENDOR_DIR]) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".tgz")) fs.rmSync(path.join(dir, f));
    }
  }
}

// Build + pack the local @seamless-auth/react into ./react-vendor so the react
// service installs it over the published version (--local browser runs).
async function packLocalReactSdk(env: NodeJS.ProcessEnv): Promise<void> {
  const sdkDir = resolveReactSdkDir();
  console.log(kleur.cyan("→ Building & packing local @seamless-auth/react…"));
  await runCommand("npm", ["run", "build"], sdkDir, env);
  await runCommand("npm", ["pack", "--pack-destination", REACT_VENDOR_DIR], sdkDir, env);
}

async function packLocalSdks(env: NodeJS.ProcessEnv): Promise<void> {
  const serverDir = resolveServerDir();
  console.log(kleur.cyan("→ Building & packing local @seamless-auth/* (core, express)…"));
  await runCommand("pnpm", ["--filter", "@seamless-auth/core", "build"], serverDir, env);
  await runCommand("pnpm", ["--filter", "@seamless-auth/express", "build"], serverDir, env);
  for (const pkg of ["@seamless-auth/core", "@seamless-auth/express"]) {
    await runCommand(
      "pnpm",
      ["--filter", pkg, "pack", "--pack-destination", VENDOR_DIR],
      serverDir,
      env,
    );
  }
}

function compose(env: NodeJS.ProcessEnv, ...args: string[]): Promise<void> {
  return runCommand("docker", ["compose", "-f", COMPOSE_FILE, ...args], VERIFY_DIR, env);
}

export async function runVerify(args: string[] = []): Promise<void> {
  const opts = parseArgs(args);
  console.log(kleur.bold("\nSeamless Verify — auth conformance"));
  console.log(kleur.dim(`SDK: ${opts.local ? "local (built from source)" : "released (npm)"}\n`));

  ensureDocker();
  const apiDir = resolveApiDir();
  const reactDir = opts.react ? resolveReactDir() : undefined;

  const serviceToken = process.env.API_SERVICE_TOKEN ?? "verify-dev-service-token";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SEAMLESS_API_DIR: apiDir,
    API_SERVICE_TOKEN: serviceToken,
    JWKS_KID: process.env.JWKS_KID ?? "dev-main",
    SEAMLESS_BOOTSTRAP_SECRET:
      process.env.SEAMLESS_BOOTSTRAP_SECRET ?? "verify-dev-bootstrap-secret",
    // consumed by the harness
    SEAMLESS_API_SERVICE_TOKEN: serviceToken,
    SEAMLESS_API_URL: "http://localhost:5312",
    SEAMLESS_ADAPTER_URL: "http://localhost:3000",
    ...(opts.apiOnly ? {} : { SEAMLESS_VERIFY_ADAPTER: "1" }),
    ...(reactDir
      ? {
          SEAMLESS_REACT_DIR: reactDir,
          SEAMLESS_REACT_URL: "http://localhost:5173",
          SEAMLESS_VERIFY_REACT: "1",
        }
      : {}),
  };

  const services = ["postgres", "auth-api"];
  if (!opts.apiOnly) services.push("adapter");
  if (opts.react) services.push("react");
  // The react service is behind a compose profile so non-browser runs skip its build.
  const profileArgs = opts.react ? ["--profile", "react"] : [];

  let failed = false;
  try {
    // The adapter / react images install local @seamless-auth/* tarballs when present.
    cleanVendor();
    if (opts.local) await packLocalSdks(env);
    if (opts.local && opts.react) await packLocalReactSdk(env);

    // Fresh volumes each run → deterministic system_config seed (e.g. LOGIN_METHODS).
    console.log(kleur.cyan("→ Cleaning any previous stack…"));
    await compose(env, ...profileArgs, "down", "-v").catch(() => undefined);

    console.log(kleur.cyan(`→ Building & starting the stack (${services.join(", ")})…`));
    await compose(env, ...profileArgs, "up", "-d", "--build", ...services);

    if (!fs.existsSync(path.join(HARNESS_DIR, "node_modules"))) {
      console.log(kleur.cyan("→ Installing harness dependencies…"));
      await runCommand("npm", ["install"], HARNESS_DIR, env);
    }
    if (opts.react) {
      console.log(kleur.cyan("→ Ensuring the Chromium browser is installed…"));
      await runCommand("npx", ["playwright", "install", "chromium"], HARNESS_DIR, env);
    }

    console.log(kleur.cyan("→ Running the conformance harness…\n"));
    const projects = ["api"];
    if (!opts.apiOnly) projects.push("adapter");
    if (opts.react) projects.push("react");
    const passthrough: string[] = projects.flatMap((p) => ["--project", p]);
    if (opts.grep) passthrough.push("--grep", opts.grep);
    await runCommand("npm", ["test", "--", ...passthrough], HARNESS_DIR, env);

    console.log(kleur.green("\n✔ Conformance passed.\n"));
  } catch (err) {
    failed = true;
    console.log(kleur.red(`\n✖ Conformance failed: ${(err as Error).message}\n`));
  } finally {
    if (opts.keepUp) {
      const profileHint = opts.react ? "--profile react " : "";
      console.log(kleur.dim("Stack left running (--keep-up). Tear down with:"));
      console.log(kleur.dim(`  docker compose -f ${COMPOSE_FILE} ${profileHint}down -v\n`));
    } else {
      console.log(kleur.cyan("→ Tearing down…"));
      await compose(env, ...profileArgs, "down", "-v").catch(() => undefined);
    }
  }

  if (failed) process.exit(1);
}
