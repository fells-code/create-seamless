import fs from "fs";
import path from "path";
import { detectPackageManager } from "./packageManager.js";

export async function inspectProject(root: string) {
  const hasPackageJson = fs.existsSync(path.join(root, "package.json"));

  return {
    root,
    packageManager: detectPackageManager(root),
    detected: {
      packageJson: hasPackageJson,
      anything: hasPackageJson,
    },
  };
}
