import fs from "fs";
import { confirm, isCancel } from "@clack/prompts";
import kleur from "kleur";
import { extractFlag } from "../core/args.js";
import { createAuthClient, ReauthRequiredError, type AuthClient } from "../core/authClient.js";
import {
  ConfigApiError,
  diffConfig,
  filterWritable,
  getRoles,
  getSystemConfig,
  parseValue,
  patchSystemConfig,
  PermissionError,
  type ConfigChange,
  type SystemConfig,
} from "../core/systemConfig.js";

export async function runConfig(args: string[]): Promise<void> {
  const sub = args[0];
  const { value: profileFlag, rest } = extractFlag(args.slice(1), "profile");

  try {
    const client = await createAuthClient({ profileFlag });
    switch (sub) {
      case "get":
        await configGet(client, rest);
        return;
      case "set":
        await configSet(client, rest);
        return;
      case "roles":
        await configRoles(client, rest);
        return;
      case "diff":
        await configDiff(client, rest);
        return;
      case "apply":
        await configApply(client, rest);
        return;
      default:
        console.error(kleur.red(`Unknown config subcommand: ${sub ?? "(none)"}`));
        console.log("Usage: seamless config <get|set|roles|diff|apply>");
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      console.log(kleur.yellow(err.message));
      process.exit(1);
    }
    if (err instanceof PermissionError || err instanceof ConfigApiError) {
      console.error(kleur.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

async function configGet(client: AuthClient, rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const key = rest.find((arg) => !arg.startsWith("--"));
  const config = await getSystemConfig(client);

  if (key) {
    if (!(key in config)) {
      console.error(kleur.red(`No such config key: ${key}`));
      process.exit(1);
    }
    const value = config[key];
    console.log(
      json
        ? JSON.stringify(value, null, 2)
        : typeof value === "string"
          ? value
          : JSON.stringify(value, null, 2),
    );
    return;
  }

  if (json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  printConfig(config);
}

async function configSet(client: AuthClient, rest: string[]): Promise<void> {
  const positional = rest.filter((arg) => !arg.startsWith("--"));
  const [key, ...valueParts] = positional;
  if (!key || valueParts.length === 0) {
    console.error(kleur.red("Usage: seamless config set <key> <value>"));
    process.exit(1);
  }

  const value = parseValue(valueParts.join(" "));
  const result = await patchSystemConfig(client, { [key]: value });

  if (result.updatedKeys.length) {
    console.log(kleur.green(`Updated: ${result.updatedKeys.join(", ")}`));
  } else {
    console.log(kleur.dim("No changes."));
  }
}

async function configRoles(client: AuthClient, rest: string[]): Promise<void> {
  const json = rest.includes("--json");
  const roles = await getRoles(client);

  if (json) {
    console.log(JSON.stringify(roles, null, 2));
    return;
  }
  if (roles.length === 0) {
    console.log(kleur.dim("No roles."));
    return;
  }
  for (const role of roles) {
    console.log("  " + role);
  }
}

async function configDiff(client: AuthClient, rest: string[]): Promise<void> {
  const file = rest.find((arg) => !arg.startsWith("--"));
  if (!file) {
    console.error(kleur.red("Usage: seamless config diff <file>"));
    process.exit(1);
  }

  const local = readConfigFile(file);
  const remote = await getSystemConfig(client);
  const changes = diffConfig(local, remote);

  if (changes.length === 0) {
    console.log(kleur.green("In sync. No differences."));
    return;
  }
  printChanges(changes);
}

async function configApply(client: AuthClient, rest: string[]): Promise<void> {
  const dryRun = rest.includes("--dry-run");
  const file = rest.find((arg) => !arg.startsWith("--"));
  if (!file) {
    console.error(kleur.red("Usage: seamless config apply <file> [--dry-run]"));
    process.exit(1);
  }

  const local = readConfigFile(file);
  const { patch, dropped } = filterWritable(local);
  if (dropped.length) {
    console.log(
      kleur.dim(`Ignoring read-only or unknown keys: ${dropped.join(", ")}`),
    );
  }

  const remote = await getSystemConfig(client);
  const changes = diffConfig(patch, remote);

  if (changes.length === 0) {
    console.log(kleur.green("Already in sync. Nothing to apply."));
    return;
  }

  printChanges(changes);

  if (dryRun) {
    console.log(kleur.dim("Dry run: no changes applied."));
    return;
  }

  const proceed = await confirm({
    message: `Apply ${changes.length} change${
      changes.length === 1 ? "" : "s"
    } to ${client.profile.instanceUrl}?`,
    initialValue: false,
  });
  if (isCancel(proceed) || !proceed) {
    console.log("Cancelled.");
    return;
  }

  const body = Object.fromEntries(changes.map((change) => [change.key, change.to]));
  const result = await patchSystemConfig(client, body);
  console.log(
    kleur.green(
      `Applied. Updated: ${result.updatedKeys.join(", ") || "(none reported)"}`,
    ),
  );
}

function readConfigFile(file: string): SystemConfig {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    throw new ConfigApiError(`Could not read file: ${file}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigApiError(`${file} is not valid JSON.`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigApiError(`${file} must contain a JSON object.`);
  }
  return parsed as SystemConfig;
}

function inline(value: unknown): string {
  return value === undefined ? "(unset)" : JSON.stringify(value);
}

function printConfig(config: SystemConfig): void {
  const keys = Object.keys(config).sort();
  const width = keys.reduce((max, key) => Math.max(max, key.length), 0);
  for (const key of keys) {
    console.log(kleur.dim(key.padEnd(width) + "  ") + inline(config[key]));
  }
}

function printChanges(changes: ConfigChange[]): void {
  for (const change of changes) {
    console.log(kleur.bold(change.key));
    console.log("  " + kleur.red(`- ${inline(change.from)}`));
    console.log("  " + kleur.green(`+ ${inline(change.to)}`));
  }
}
