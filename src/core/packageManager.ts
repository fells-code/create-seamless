import fs from "fs";
import path from "path";

export type PackageManager = "npm" | "pnpm" | "yarn";

export function detectPackageManager(root: string): PackageManager {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  return "npm";
}
