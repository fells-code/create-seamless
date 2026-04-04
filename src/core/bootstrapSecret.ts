import fs from "fs";
import path from "path";

export function resolveBootstrapSecret(): string | null {
  const root = process.cwd();

  if (process.env.SEAMLESS_BOOTSTRAP_SECRET) {
    return process.env.SEAMLESS_BOOTSTRAP_SECRET;
  }

  const rootEnv = path.join(root, ".env");
  if (fs.existsSync(rootEnv)) {
    const content = fs.readFileSync(rootEnv, "utf-8");
    const match = content.match(/SEAMLESS_BOOTSTRAP_SECRET=(.*)/);
    if (match) return match[1].trim();
  }

  const authEnv = path.join(root, "auth", ".env");
  if (fs.existsSync(authEnv)) {
    const content = fs.readFileSync(authEnv, "utf-8");
    const match = content.match(/SEAMLESS_BOOTSTRAP_SECRET=(.*)/);
    if (match) return match[1].trim();
  }

  const compose = path.join(root, "docker-compose.yml");
  if (fs.existsSync(compose)) {
    const content = fs.readFileSync(compose, "utf-8");

    const match = content.match(/SEAMLESS_BOOTSTRAP_SECRET:\s*(.*)/);
    if (match) return match[1].trim();
  }

  return null;
}
