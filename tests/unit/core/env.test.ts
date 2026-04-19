import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseEnv, parseEnvString, writeEnv } from "../../../src/core/env.js";
import { cleanupTempDir, createTempDir } from "../../helpers/index.js";

describe("env helpers", () => {
  it("parses env files and preserves values containing '='", () => {
    const root = createTempDir();

    try {
      const filePath = path.join(root, ".env");

      fs.writeFileSync(
        filePath,
        "# comment\nFOO=bar\nCOMPLEX=value=with=equals\nEMPTY=\n\n",
      );

      expect(parseEnv(filePath)).toEqual({
        FOO: "bar",
        COMPLEX: "value=with=equals",
        EMPTY: "",
      });
    } finally {
      cleanupTempDir(root);
    }
  });

  it("writes env files that can be parsed back consistently", () => {
    const root = createTempDir();

    try {
      const filePath = path.join(root, ".env");

      writeEnv(filePath, {
        AUTH_SERVER_URL: "http://localhost:5312",
        API_SERVICE_TOKEN: "secret=value",
      });

      const written = fs.readFileSync(filePath, "utf-8");

      expect(written.endsWith("\n")).toBe(true);
      expect(parseEnv(filePath)).toEqual({
        AUTH_SERVER_URL: "http://localhost:5312",
        API_SERVICE_TOKEN: "secret=value",
      });
    } finally {
      cleanupTempDir(root);
    }
  });

  it("parses raw env strings", () => {
    expect(
      parseEnvString("FOO=bar\nBAR=baz=qux\n# ignored\nQUUX=zip\n"),
    ).toEqual({
      FOO: "bar",
      BAR: "baz=qux",
      QUUX: "zip",
    });
  });
});
