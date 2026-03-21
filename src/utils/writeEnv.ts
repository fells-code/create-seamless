import path from "path";
import fs from "fs";

export function writeEnv(dir: string, values: Record<string, any>) {
  const env = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  fs.writeFileSync(path.join(dir, ".env"), env + "\n");
}
