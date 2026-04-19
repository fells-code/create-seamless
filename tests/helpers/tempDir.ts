import fs from "fs";
import os from "os";
import path from "path";

export function createTempDir(prefix = "create-seamless-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}
