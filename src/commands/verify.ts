import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import kleur from "kleur";

import { runCommand } from "../core/exec.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const VERIFY_DIR = path.join(REPO_ROOT, "verify");
const COMPOSE_FILE = path.join(VERIFY_DIR, "docker-compose.verify.yml");
const HARNESS_DIR = path.join(VERIFY_DIR, "harness");

interface VerifyOptions {
  released: boolean;
  keepUp: boolean;
  apiOnly: boolean;
  grep?: string;
}

function parseArgs(args: string[]): VerifyOptions {
  return {
    released: args.includes("--released"),
    keepUp: args.includes("--keep-up"),
    apiOnly: args.includes("--api-only"),
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

function compose(env: NodeJS.ProcessEnv, ...args: string[]): Promise<void> {
  return runCommand("docker", ["compose", "-f", COMPOSE_FILE, ...args], VERIFY_DIR, env);
}

export async function runVerify(args: string[] = []): Promise<void> {
  const opts = parseArgs(args);
  console.log(kleur.bold("\nSeamless Verify — auth conformance\n"));

  if (opts.released) {
    console.log(kleur.yellow("--released mode is not implemented yet; running --local.\n"));
  }

  ensureDocker();
  const apiDir = resolveApiDir();

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
  };

  const services = opts.apiOnly
    ? ["postgres", "auth-api"]
    : ["postgres", "auth-api", "adapter"];

  let failed = false;
  try {
    // Fresh volumes each run → deterministic system_config seed (e.g. LOGIN_METHODS).
    console.log(kleur.cyan("→ Cleaning any previous stack…"));
    await compose(env, "down", "-v").catch(() => undefined);

    console.log(kleur.cyan(`→ Building & starting the stack (${services.join(", ")})…`));
    await compose(env, "up", "-d", "--build", ...services);

    if (!fs.existsSync(path.join(HARNESS_DIR, "node_modules"))) {
      console.log(kleur.cyan("→ Installing harness dependencies…"));
      await runCommand("npm", ["install"], HARNESS_DIR, env);
    }

    console.log(kleur.cyan("→ Running the conformance harness…\n"));
    const passthrough: string[] = [];
    if (opts.apiOnly) passthrough.push("--project=api");
    if (opts.grep) passthrough.push("--grep", opts.grep);
    const testArgs = passthrough.length ? ["test", "--", ...passthrough] : ["test"];
    await runCommand("npm", testArgs, HARNESS_DIR, env);

    console.log(kleur.green("\n✔ Conformance passed.\n"));
  } catch (err) {
    failed = true;
    console.log(kleur.red(`\n✖ Conformance failed: ${(err as Error).message}\n`));
  } finally {
    if (opts.keepUp) {
      console.log(kleur.dim("Stack left running (--keep-up). Tear down with:"));
      console.log(kleur.dim(`  docker compose -f ${COMPOSE_FILE} down -v\n`));
    } else {
      console.log(kleur.cyan("→ Tearing down…"));
      await compose(env, "down", "-v").catch(() => undefined);
    }
  }

  if (failed) process.exit(1);
}
