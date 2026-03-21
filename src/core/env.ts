import fs from "fs";

export function parseEnv(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");

  const lines = content.split("\n");

  const env: Record<string, string> = {};

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const [key, ...rest] = line.split("=");
    if (!key) continue;

    env[key.trim()] = rest.join("=").trim();
  }

  return env;
}

export function parseEnvString(content: string): Record<string, string> {
  const lines = content.split("\n");

  const env: Record<string, string> = {};

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const [key, ...rest] = line.split("=");

    if (!key) continue;

    env[key.trim()] = rest.join("=").trim();
  }

  return env;
}

export function writeEnv(filePath: string, env: Record<string, string>) {
  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  fs.writeFileSync(filePath, content + "\n");
}
