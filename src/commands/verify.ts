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
  grep?: string;
}

function parseArgs(args: string[]): VerifyOptions {
  return {
    released: args.includes("--released"),
    keepUp: args.includes("--keep-up"),
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

function resolveSourceDirs(): { apiDir: string; adapterDir: string } {
  const apiDir = process.env.SEAMLESS_API_DIR;
  const adapterDir = process.env.SEAMLESS_ADAPTER_DIR;
  if (!apiDir || !adapterDir) {
    throw new Error(
      "Set SEAMLESS_API_DIR and SEAMLESS_ADAPTER_DIR to local source checkouts.\n" +
        "  (Released-mode auto-clone lands in a later milestone.)",
    );
  }
  return { apiDir, adapterDir };
}

export async function runVerify(args: string[] = []): Promise<void> {
  const opts = parseArgs(args);
  console.log(kleur.bold("\nSeamless Verify — auth conformance\n"));

  if (opts.released) {
    console.log(kleur.yellow("--released mode is not implemented yet; running --local.\n"));
  }

  ensureDocker();
  const { apiDir, adapterDir } = resolveSourceDirs();

  const serviceToken = process.env.API_SERVICE_TOKEN ?? "verify-dev-service-token";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SEAMLESS_API_DIR: apiDir,
    SEAMLESS_ADAPTER_DIR: adapterDir,
    API_SERVICE_TOKEN: serviceToken,
    JWKS_KID: process.env.JWKS_KID ?? "dev-main",
    SEAMLESS_BOOTSTRAP_SECRET:
      process.env.SEAMLESS_BOOTSTRAP_SECRET ?? "verify-dev-bootstrap-secret",
    // consumed by the harness
    SEAMLESS_API_SERVICE_TOKEN: serviceToken,
    SEAMLESS_API_URL: "http://localhost:5312",
  };

  let failed = false;
  try {
    console.log(kleur.cyan("→ Building & starting the stack (postgres + auth-api)…"));
    await runCommand(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "up", "-d", "--build", "postgres", "auth-api"],
      VERIFY_DIR,
      env,
    );

    if (!fs.existsSync(path.join(HARNESS_DIR, "node_modules"))) {
      console.log(kleur.cyan("→ Installing harness dependencies…"));
      await runCommand("npm", ["install"], HARNESS_DIR, env);
    }

    console.log(kleur.cyan("→ Running the conformance harness…\n"));
    const testArgs = ["test", "--", "--project=api"];
    if (opts.grep) testArgs.push("--grep", opts.grep);
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
      await runCommand(
        "docker",
        ["compose", "-f", COMPOSE_FILE, "down", "-v"],
        VERIFY_DIR,
        env,
      ).catch(() => undefined);
    }
  }

  if (failed) process.exit(1);
}
