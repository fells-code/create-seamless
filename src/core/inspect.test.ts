import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectProject } from "./inspect.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-inspect-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("inspectProject", () => {
  it("reports package.json detected and picks up the package manager", async () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");

    const result = await inspectProject(tmpDir);

    expect(result).toEqual({
      root: tmpDir,
      packageManager: "pnpm",
      detected: {
        packageJson: true,
        anything: true,
      },
    });
  });

  it("reports nothing detected and defaults to npm when the directory is empty", async () => {
    const result = await inspectProject(tmpDir);

    expect(result).toEqual({
      root: tmpDir,
      packageManager: "npm",
      detected: {
        packageJson: false,
        anything: false,
      },
    });
  });
});
