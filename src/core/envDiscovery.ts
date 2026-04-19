import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  DeployEnvVar,
  DeployManifest,
  DeployServiceEnvMap,
  DeployServiceName,
} from "./deployManifest.js";
import { inferEnvKind, isDeployManagedKey } from "./envRegistry.js";

interface ParsedEnvMap {
  [key: string]: string;
}

interface DiscoveredEnvEntry {
  key: string;
  value: string | null;
  source: "env" | "env_example";
}

function parseEnvFile(filePath: string): ParsedEnvMap {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const result: ParsedEnvMap = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function discoverServiceEnvEntries(
  root: string,
  servicePath: string | null,
): DiscoveredEnvEntry[] {
  if (!servicePath) return [];

  const absolutePath = path.resolve(root, servicePath);
  if (!fs.existsSync(absolutePath)) return [];

  const envPath = path.join(absolutePath, ".env");
  const envExamplePath = path.join(absolutePath, ".env.example");

  const merged = new Map<string, DiscoveredEnvEntry>();

  if (fs.existsSync(envExamplePath)) {
    const parsed = parseEnvFile(envExamplePath);
    for (const [key, value] of Object.entries(parsed)) {
      merged.set(key, {
        key,
        value: value || null,
        source: "env_example",
      });
    }
  }

  if (fs.existsSync(envPath)) {
    const parsed = parseEnvFile(envPath);
    for (const [key, value] of Object.entries(parsed)) {
      merged.set(key, {
        key,
        value: value || null,
        source: "env",
      });
    }
  }

  return [...merged.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function mergeServiceEnv(
  existing: DeployEnvVar[],
  discovered: DiscoveredEnvEntry[],
  service: DeployServiceName,
): DeployEnvVar[] {
  const existingUserMap = new Map(existing.map((entry) => [entry.key, entry]));
  const result: DeployEnvVar[] = [];

  for (const item of discovered) {
    if (isDeployManagedKey(service, item.key)) {
      continue;
    }

    const prior = existingUserMap.get(item.key);
    const discoveredValue = item.value?.trim() ? item.value : null;

    if (prior) {
      result.push({
        ...prior,
        value: prior.value || discoveredValue || "",
      });
      continue;
    }

    result.push({
      key: item.key,
      value: discoveredValue ?? "",
      kind: inferEnvKind(item.key),
      owner: "user",
      target: "task_definition",
      source: item.source,
    });
  }

  for (const leftover of existing) {
    if (!result.find((entry) => entry.key === leftover.key)) {
      result.push(leftover);
    }
  }

  return result.sort((a, b) => a.key.localeCompare(b.key));
}

async function promptForMissingValues(
  service: DeployServiceName,
  vars: DeployEnvVar[],
): Promise<DeployEnvVar[]> {
  const resolved: DeployEnvVar[] = [];

  for (const envVar of vars) {
    if (envVar.value && envVar.value.trim().length > 0) {
      resolved.push(envVar);
      continue;
    }

    const promptOptions = {
      message: `${service}: enter value for ${envVar.key}`,
    };

    const value =
      envVar.kind === "secret"
        ? await p.password(promptOptions)
        : await p.text(promptOptions);

    if (p.isCancel(value)) {
      p.cancel("Deploy cancelled");
      process.exit(0);
    }

    resolved.push({
      ...envVar,
      value: value.trim(),
      source: "prompt",
    });
  }

  return resolved;
}

function printDetectedEnvSummary(env: DeployServiceEnvMap): void {
  const lines: string[] = [];

  for (const service of [
    "web",
    "api",
    "auth",
    "admin",
  ] as DeployServiceName[]) {
    const entries = env[service];
    if (entries.length === 0) continue;

    lines.push(`${service}:`);
    for (const entry of entries) {
      lines.push(
        `  ${entry.key} (${entry.kind}, ${entry.value ? "value found" : "missing value"})`,
      );
    }
  }

  if (lines.length > 0) {
    p.note(lines.join("\n"), "Detected custom environment variables");
  }
}

export async function discoverAndResolveCustomEnv(
  root: string,
  manifest: DeployManifest,
): Promise<DeployServiceEnvMap> {
  const nextEnv: DeployServiceEnvMap = {
    web: mergeServiceEnv(
      manifest.env.web,
      discoverServiceEnvEntries(root, manifest.services.web.path),
      "web",
    ),
    api: mergeServiceEnv(
      manifest.env.api,
      discoverServiceEnvEntries(root, manifest.services.api.path),
      "api",
    ),
    auth: mergeServiceEnv(
      manifest.env.auth,
      manifest.services.auth.mode === "source"
        ? discoverServiceEnvEntries(root, manifest.services.auth.path)
        : [],
      "auth",
    ),
    admin: mergeServiceEnv(
      manifest.env.admin,
      manifest.services.admin.mode === "source"
        ? discoverServiceEnvEntries(root, manifest.services.admin.path)
        : [],
      "admin",
    ),
  };

  printDetectedEnvSummary(nextEnv);

  return {
    web: await promptForMissingValues("web", nextEnv.web),
    api: await promptForMissingValues("api", nextEnv.api),
    auth: await promptForMissingValues("auth", nextEnv.auth),
    admin: await promptForMissingValues("admin", nextEnv.admin),
  };
}
