import fs from "fs";
import os from "os";
import path from "path";

export type IdentifierType = "email" | "phone";

export interface Profile {
  name: string;
  instanceUrl: string;
  sub?: string;
  email?: string;
  identifierType?: IdentifierType;
}

export interface SeamlessConfig {
  activeProfile: string;
  profiles: Record<string, Profile>;
}

export const DEFAULT_PROFILE_NAME = "default";

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  const base = xdg ? xdg : path.join(os.homedir(), ".config");
  return path.join(base, "seamless");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

function emptyConfig(): SeamlessConfig {
  return { activeProfile: DEFAULT_PROFILE_NAME, profiles: {} };
}

function coerceProfile(name: string, value: unknown): Profile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.instanceUrl !== "string") return undefined;

  const profile: Profile = { name, instanceUrl: raw.instanceUrl };
  if (typeof raw.sub === "string") profile.sub = raw.sub;
  if (typeof raw.email === "string") profile.email = raw.email;
  if (raw.identifierType === "email" || raw.identifierType === "phone") {
    profile.identifierType = raw.identifierType;
  }
  return profile;
}

function normalizeLoaded(parsed: unknown): SeamlessConfig {
  if (!parsed || typeof parsed !== "object") return emptyConfig();
  const raw = parsed as Record<string, unknown>;

  const profiles: Record<string, Profile> = {};
  if (raw.profiles && typeof raw.profiles === "object") {
    for (const [name, value] of Object.entries(
      raw.profiles as Record<string, unknown>,
    )) {
      const profile = coerceProfile(name, value);
      if (profile) profiles[name] = profile;
    }
  }

  const active =
    typeof raw.activeProfile === "string" && raw.activeProfile
      ? raw.activeProfile
      : DEFAULT_PROFILE_NAME;

  return { activeProfile: active, profiles };
}

export function loadConfig(): SeamlessConfig {
  const file = getConfigPath();
  if (!fs.existsSync(file)) return emptyConfig();

  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (err) {
    throw new Error(
      `Unable to read config at ${file}: ${(err as Error).message}`,
    );
  }

  try {
    return normalizeLoaded(JSON.parse(raw));
  } catch {
    throw new Error(
      `Config at ${file} is not valid JSON. Fix or remove it and try again.`,
    );
  }
}

export function saveConfig(config: SeamlessConfig): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const file = getConfigPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function listProfiles(config: SeamlessConfig = loadConfig()): Profile[] {
  return Object.values(config.profiles);
}

export function getProfile(
  name: string,
  config: SeamlessConfig = loadConfig(),
): Profile | undefined {
  return config.profiles[name];
}

export function upsertProfile(profile: Profile): SeamlessConfig {
  const config = loadConfig();
  config.profiles[profile.name] = profile;
  if (!config.profiles[config.activeProfile]) {
    config.activeProfile = profile.name;
  }
  saveConfig(config);
  return config;
}

export function removeProfile(name: string): SeamlessConfig {
  const config = loadConfig();
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist.`);
  }

  delete config.profiles[name];
  if (config.activeProfile === name) {
    config.activeProfile = Object.keys(config.profiles)[0] ?? DEFAULT_PROFILE_NAME;
  }

  saveConfig(config);
  return config;
}

export function setActiveProfile(name: string): SeamlessConfig {
  const config = loadConfig();
  if (!config.profiles[name]) {
    throw new Error(
      `Profile "${name}" does not exist. Add it with "seamless profile add ${name}".`,
    );
  }

  config.activeProfile = name;
  saveConfig(config);
  return config;
}

export function resolveActiveProfileName(
  opts: { profileFlag?: string } = {},
  config: SeamlessConfig = loadConfig(),
): string {
  return (
    opts.profileFlag?.trim() ||
    process.env.SEAMLESS_PROFILE?.trim() ||
    config.activeProfile ||
    DEFAULT_PROFILE_NAME
  );
}

export function getActiveProfile(
  opts: { profileFlag?: string } = {},
): Profile | undefined {
  const config = loadConfig();
  return config.profiles[resolveActiveProfileName(opts, config)];
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalInstanceUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL((input ?? "").trim());
  } catch {
    return false;
  }
  const host = url.hostname;
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

export function normalizeInstanceUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    throw new Error("Instance URL is required.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid instance URL: "${input}". Include the scheme, for example https://auth.example.com.`,
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      `Instance URL must use http or https, got "${url.protocol}".`,
    );
  }

  const host = url.hostname;
  if (url.protocol === "http:" && !isLocalInstanceUrl(trimmed)) {
    throw new Error(
      `Instance URL must use https for non-local host "${host}".`,
    );
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}
