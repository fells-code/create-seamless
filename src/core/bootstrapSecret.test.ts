import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveBootstrapSecret } from "./bootstrapSecret.js";

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-bootstrap-"));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
  delete process.env.SEAMLESS_BOOTSTRAP_SECRET;
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.SEAMLESS_BOOTSTRAP_SECRET;
});

describe("resolveBootstrapSecret", () => {
  it("prefers the SEAMLESS_BOOTSTRAP_SECRET env var over any file", () => {
    process.env.SEAMLESS_BOOTSTRAP_SECRET = '"env-secret"';
    fs.writeFileSync(path.join(tmpDir, ".env"), "SEAMLESS_BOOTSTRAP_SECRET=file-secret\n");

    expect(resolveBootstrapSecret()).toBe("env-secret");
  });

  it("reads from the root .env file when no env var is set", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "SEAMLESS_BOOTSTRAP_SECRET=root-secret\n");
    expect(resolveBootstrapSecret()).toBe("root-secret");
  });

  it("falls back to auth/.env when the root .env has no match", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "OTHER=1\n");
    fs.mkdirSync(path.join(tmpDir, "auth"));
    fs.writeFileSync(
      path.join(tmpDir, "auth", ".env"),
      "SEAMLESS_BOOTSTRAP_SECRET=auth-secret\n",
    );

    expect(resolveBootstrapSecret()).toBe("auth-secret");
  });

  it("falls back to docker-compose.yml when no .env files match", () => {
    fs.writeFileSync(
      path.join(tmpDir, "docker-compose.yml"),
      "services:\n  auth:\n    environment:\n      SEAMLESS_BOOTSTRAP_SECRET: compose-secret\n",
    );

    expect(resolveBootstrapSecret()).toBe("compose-secret");
  });

  it("returns null when nothing matches anywhere", () => {
    expect(resolveBootstrapSecret()).toBeNull();
  });

  it("strips matching single quotes from a normalized value", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "SEAMLESS_BOOTSTRAP_SECRET='quoted-secret'\n");
    expect(resolveBootstrapSecret()).toBe("quoted-secret");
  });

  it("trims whitespace without unquoting mismatched quotes", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".env"),
      'SEAMLESS_BOOTSTRAP_SECRET=  "unbalanced \n',
    );
    expect(resolveBootstrapSecret()).toBe('"unbalanced');
  });

  it("returns null when the root .env exists but has no matching key", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "OTHER=1\n");
    expect(resolveBootstrapSecret()).toBeNull();
  });

  it("returns null when auth/.env exists but has no matching key", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "OTHER=1\n");
    fs.mkdirSync(path.join(tmpDir, "auth"));
    fs.writeFileSync(path.join(tmpDir, "auth", ".env"), "OTHER=1\n");
    expect(resolveBootstrapSecret()).toBeNull();
  });

  it("returns null when docker-compose.yml exists but has no matching key", () => {
    fs.writeFileSync(path.join(tmpDir, "docker-compose.yml"), "services:\n  auth: {}\n");
    expect(resolveBootstrapSecret()).toBeNull();
  });
});
