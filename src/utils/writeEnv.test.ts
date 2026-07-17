import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeEnv } from "./writeEnv.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-writeenv-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("writeEnv", () => {
  it("writes a .env file with key=value pairs and a trailing newline", () => {
    writeEnv(tmpDir, { FOO: "bar", COUNT: 3 });

    const content = fs.readFileSync(path.join(tmpDir, ".env"), "utf-8");
    expect(content).toBe("FOO=bar\nCOUNT=3\n");
  });

  it("writes just a trailing newline for an empty values object", () => {
    writeEnv(tmpDir, {});
    expect(fs.readFileSync(path.join(tmpDir, ".env"), "utf-8")).toBe("\n");
  });

  it("overwrites an existing .env file", () => {
    writeEnv(tmpDir, { FOO: "1" });
    writeEnv(tmpDir, { FOO: "2" });
    expect(fs.readFileSync(path.join(tmpDir, ".env"), "utf-8")).toBe("FOO=2\n");
  });
});
