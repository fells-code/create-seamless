import { describe, expect, it, vi } from "vitest";
import { resolveBootstrapSecret } from "../../../src/core/bootstrapSecret.js";
import {
  cleanupTempDir,
  createTempDir,
  withCwd,
  writeFile,
} from "../../helpers/index.js";

describe("resolveBootstrapSecret", () => {
  it("prefers the process environment over project files", async () => {
    const root = createTempDir();

    try {
      writeFile(root, ".env", "SEAMLESS_BOOTSTRAP_SECRET=root-secret\n");
      writeFile(root, "auth/.env", "SEAMLESS_BOOTSTRAP_SECRET=auth-secret\n");
      writeFile(
        root,
        "docker-compose.yml",
        "services:\n  auth:\n    environment:\n      SEAMLESS_BOOTSTRAP_SECRET: compose-secret\n",
      );

      vi.stubEnv("SEAMLESS_BOOTSTRAP_SECRET", "process-secret");

      await withCwd(root, () => {
        expect(resolveBootstrapSecret()).toBe("process-secret");
      });
    } finally {
      cleanupTempDir(root);
    }
  });

  it("falls back from root env to auth env to docker compose", async () => {
    const root = createTempDir();

    try {
      writeFile(root, "auth/.env", "SEAMLESS_BOOTSTRAP_SECRET=auth-secret\n");
      writeFile(
        root,
        "docker-compose.yml",
        "services:\n  auth:\n    environment:\n      SEAMLESS_BOOTSTRAP_SECRET: compose-secret\n",
      );

      await withCwd(root, () => {
        expect(resolveBootstrapSecret()).toBe("auth-secret");
      });

      writeFile(root, ".env", "SEAMLESS_BOOTSTRAP_SECRET=root-secret\n");

      await withCwd(root, () => {
        expect(resolveBootstrapSecret()).toBe("root-secret");
      });
    } finally {
      cleanupTempDir(root);
    }
  });

  it("returns null when no secret source exists", async () => {
    const root = createTempDir();

    try {
      await withCwd(root, () => {
        expect(resolveBootstrapSecret()).toBeNull();
      });
    } finally {
      cleanupTempDir(root);
    }
  });
});
