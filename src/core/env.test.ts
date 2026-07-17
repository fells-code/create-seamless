import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseEnv, parseEnvString, writeEnv } from "./env.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-env-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("parseEnv", () => {
  it("parses simple key=value lines from a file", () => {
    const file = path.join(tmpDir, ".env");
    fs.writeFileSync(file, "FOO=bar\nBAZ=qux\n");

    expect(parseEnv(file)).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("skips blank lines and comment lines", () => {
    const file = path.join(tmpDir, ".env");
    fs.writeFileSync(file, "\n# a comment\nFOO=bar\n\n#another\nBAZ=qux\n");

    expect(parseEnv(file)).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("skips lines with no key", () => {
    const file = path.join(tmpDir, ".env");
    fs.writeFileSync(file, "=novalue\nFOO=bar\n");

    expect(parseEnv(file)).toEqual({ FOO: "bar" });
  });

  it("trims whitespace around key and value", () => {
    const file = path.join(tmpDir, ".env");
    fs.writeFileSync(file, "  FOO  =  bar  \n");

    expect(parseEnv(file)).toEqual({ FOO: "bar" });
  });

  it("rejoins values that contain an equals sign", () => {
    const file = path.join(tmpDir, ".env");
    fs.writeFileSync(file, "URL=https://example.com?a=1&b=2\n");

    expect(parseEnv(file)).toEqual({ URL: "https://example.com?a=1&b=2" });
  });

  it("keeps quotes in values as-is (no unquoting)", () => {
    const file = path.join(tmpDir, ".env");
    fs.writeFileSync(file, 'FOO="bar baz"\n');

    expect(parseEnv(file)).toEqual({ FOO: '"bar baz"' });
  });
});

describe("parseEnvString", () => {
  it("parses simple key=value lines from a string", () => {
    expect(parseEnvString("FOO=bar\nBAZ=qux\n")).toEqual({
      FOO: "bar",
      BAZ: "qux",
    });
  });

  it("skips blank lines and comment lines", () => {
    expect(parseEnvString("\n# a comment\nFOO=bar\n\n#another\n")).toEqual({
      FOO: "bar",
    });
  });

  it("skips lines with no key", () => {
    expect(parseEnvString("=novalue\nFOO=bar\n")).toEqual({ FOO: "bar" });
  });

  it("trims whitespace around key and value", () => {
    expect(parseEnvString("  FOO  =  bar  ")).toEqual({ FOO: "bar" });
  });

  it("rejoins values that contain an equals sign", () => {
    expect(parseEnvString("A=1=2=3")).toEqual({ A: "1=2=3" });
  });

  it("returns an empty object for empty content", () => {
    expect(parseEnvString("")).toEqual({});
  });
});

describe("writeEnv", () => {
  it("writes key=value pairs, one per line, with a trailing newline", () => {
    const file = path.join(tmpDir, "out.env");
    writeEnv(file, { FOO: "bar", BAZ: "qux" });

    expect(fs.readFileSync(file, "utf-8")).toBe("FOO=bar\nBAZ=qux\n");
  });

  it("writes just a trailing newline for an empty env object", () => {
    const file = path.join(tmpDir, "empty.env");
    writeEnv(file, {});

    expect(fs.readFileSync(file, "utf-8")).toBe("\n");
  });

  it("round-trips through parseEnv", () => {
    const file = path.join(tmpDir, "roundtrip.env");
    const original = { A: "1", B: "two", C: "" };
    writeEnv(file, original);

    expect(parseEnv(file)).toEqual(original);
  });
});
