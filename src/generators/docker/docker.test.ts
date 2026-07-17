import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthEnv,
  buildJWKSConfig,
  configureAuthLocalEnv,
  envToDockerBlock,
  extractSharedFromExistingEnv,
  generateDockerCompose,
} from "./docker.js";
import {
  POSTGRES_IMAGE,
  SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE,
  SEAMLESS_AUTH_API_IMAGE,
} from "../../core/images.js";
import type { CollectedOAuthProvider } from "../../core/oauthProviders.js";
import { OAUTH_PROVIDER_CATALOG } from "../../core/oauthProviders.js";

let tmpDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-docker-test-"));
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  logSpy.mockRestore();
  vi.unstubAllGlobals();
});

function googleProvider(
  overrides: Partial<CollectedOAuthProvider> = {},
): CollectedOAuthProvider {
  const catalog = OAUTH_PROVIDER_CATALOG.find((p) => p.id === "google")!;
  return { catalog, clientId: "gid", clientSecret: "gsecret", ...overrides };
}

function writeAuthEnvFixture(root: string, kidKey?: string) {
  fs.mkdirSync(path.join(root, "auth"), { recursive: true });
  const lines = ["API_SERVICE_TOKEN=existing-token"];
  if (kidKey) lines.push(`${kidKey}=existing-kid`);
  fs.writeFileSync(path.join(root, "auth", ".env"), lines.join("\n") + "\n");
}

function stubEnvExampleFetch(content: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, text: async () => content })),
  );
}

describe("envToDockerBlock", () => {
  it("renders single-line values as quoted JSON strings", () => {
    const block = envToDockerBlock({ FOO: "bar", BAZ: "1 2 3" });
    expect(block).toBe('      FOO: "bar"\n      BAZ: "1 2 3"');
  });

  it("renders multiline values as an indented block scalar", () => {
    const block = envToDockerBlock({ KEY: "line1\nline2" });
    expect(block).toBe("      KEY: |\n        line1\n        line2");
  });
});

describe("buildJWKSConfig", () => {
  it("generates a keypair and a valid public JWKS document", () => {
    const config = buildJWKSConfig();

    expect(config.kid).toBe("main");
    expect(config.privateKey).toContain("PRIVATE KEY");
    expect(config.publicKey).toContain("PUBLIC KEY");

    const parsed = JSON.parse(config.publicJwksJson);
    expect(parsed).toEqual({
      keys: [{ kid: "main", pem: config.publicKey }],
    });
  });
});

describe("buildAuthEnv", () => {
  it("wires docker-mode networking values", () => {
    const { env, shared } = buildAuthEnv({}, "docker");

    expect(env.ISSUER).toBe("http://auth:5312");
    expect(env.DB_HOST).toBe("db");
    expect(env.AUTH_MODE).toBe("server");
    expect(env.PORT).toBe("5312");
    expect(env.NODE_ENV).toBe("development");
    expect(env.SEAMLESS_BOOTSTRAP_ENABLED).toBe("true");
    expect(env.SEAMLESS_BOOTSTRAP_SECRET).toBe(shared.bootstrapSecret);
    expect(env.API_SERVICE_TOKEN).toBe(shared.apiToken);
    expect(env.REFRESH_TOKEN_LOOKUP_SECRET).toMatch(/^[0-9a-f]{64}$/);
    expect(env.TOTP_SECRET_ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
    expect(env.APP_ORIGINS).toBe("http://localhost:3000");
    expect(env.ORIGINS).toBe("http://localhost:5173,http://localhost:5174");
    expect(env.LOGIN_METHODS).toBeUndefined();
    expect(shared.kid).toBe("dev-main");
  });

  it("wires local-mode networking values", () => {
    const { env } = buildAuthEnv({}, "local");

    expect(env.ISSUER).toBe("http://localhost:5312");
    expect(env.DB_HOST).toBe("localhost");
  });

  it("wires oauth env vars and enables the oauth login method when providers are given", () => {
    const { env } = buildAuthEnv({}, "docker", [googleProvider()]);

    expect(env.OAUTH_STATE_SECRET).toMatch(/^[0-9a-f]{64}$/);
    const providers = JSON.parse(env.OAUTH_PROVIDERS);
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ id: "google", enabled: true });
    expect(env.LOGIN_METHODS).toBe("passkey,magic_link,oauth");
  });
});

describe("extractSharedFromExistingEnv", () => {
  it("prefers SEAMLESS_JWKS_ACTIVE_KID", () => {
    writeAuthEnvFixture(tmpDir, "SEAMLESS_JWKS_ACTIVE_KID");
    expect(extractSharedFromExistingEnv(tmpDir)).toEqual({
      apiToken: "existing-token",
      kid: "existing-kid",
    });
  });

  it("falls back to JWKS_ACTIVE_KID", () => {
    writeAuthEnvFixture(tmpDir, "JWKS_ACTIVE_KID");
    expect(extractSharedFromExistingEnv(tmpDir)).toEqual({
      apiToken: "existing-token",
      kid: "existing-kid",
    });
  });

  it("defaults kid to dev-main when neither is present", () => {
    writeAuthEnvFixture(tmpDir);
    expect(extractSharedFromExistingEnv(tmpDir)).toEqual({
      apiToken: "existing-token",
      kid: "dev-main",
    });
  });
});

describe("configureAuthLocalEnv", () => {
  it("throws when auth/.env.example is missing", async () => {
    fs.mkdirSync(path.join(tmpDir, "auth"), { recursive: true });

    await expect(configureAuthLocalEnv(tmpDir)).rejects.toThrow(
      ".env.example not found in auth directory",
    );
  });

  it("writes auth/.env derived from the example file and returns shared secrets", async () => {
    fs.mkdirSync(path.join(tmpDir, "auth"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "auth", ".env.example"),
      "SOME_KEY=placeholder\n# a comment\n",
    );

    const shared = await configureAuthLocalEnv(tmpDir, [googleProvider()]);

    expect(shared.kid).toBe("dev-main");
    expect(shared.apiToken).toMatch(/^[0-9a-f]{64}$/);

    const written = fs.readFileSync(path.join(tmpDir, "auth", ".env"), "utf-8");
    expect(written).toContain(`API_SERVICE_TOKEN=${shared.apiToken}`);
    expect(written).toContain("SOME_KEY=placeholder");
    expect(written).toContain("AUTH_MODE=server");
    expect(written).toContain("ISSUER=http://localhost:5312");
    expect(written).toContain("DB_HOST=localhost");
    expect(written.endsWith("\n")).toBe(true);
  });
});

describe("generateDockerCompose", () => {
  it("builds a local-auth compose file with an image-mode admin service", async () => {
    writeAuthEnvFixture(tmpDir, "SEAMLESS_JWKS_ACTIVE_KID");

    const shared = await generateDockerCompose(tmpDir, {
      authMode: "local",
      adminMode: "image",
      includeAdmin: true,
    });

    expect(shared).toEqual({ apiToken: "existing-token", kid: "existing-kid" });

    const compose = fs.readFileSync(
      path.join(tmpDir, "docker-compose.yml"),
      "utf-8",
    );

    expect(compose).toContain(`image: ${POSTGRES_IMAGE}`);
    expect(compose).toContain("container_name: seamless-db");
    expect(compose).toContain("build:\n      context: ./auth");
    expect(compose).toContain("env_file:\n      - ./auth/.env");
    expect(compose).toContain("DB_HOST: db");
    expect(compose).toContain("ISSUER: http://auth:5312");
    expect(compose).toContain("API_SERVICE_TOKEN: existing-token");
    expect(compose).toContain("JWKS_KID: existing-kid");
    expect(compose).toContain("container_name: web");
    expect(compose).toContain(`image: ${SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE}`);
    expect(compose).not.toContain("build: ./admin");
    expect(compose).toContain("volumes:\n  pgdata:");
    expect(compose.endsWith("\n")).toBe(true);
  });

  it("omits the admin service entirely when includeAdmin is false", async () => {
    writeAuthEnvFixture(tmpDir, "SEAMLESS_JWKS_ACTIVE_KID");

    await generateDockerCompose(tmpDir, {
      authMode: "local",
      adminMode: "image",
      includeAdmin: false,
    });

    const compose = fs.readFileSync(
      path.join(tmpDir, "docker-compose.yml"),
      "utf-8",
    );
    expect(compose).not.toContain("container_name: admin");
  });

  it("builds a source-mode admin service when includeAdmin is a truthy symbol", async () => {
    writeAuthEnvFixture(tmpDir, "SEAMLESS_JWKS_ACTIVE_KID");

    await generateDockerCompose(tmpDir, {
      authMode: "local",
      adminMode: "source",
      includeAdmin: Symbol("include"),
    });

    const compose = fs.readFileSync(
      path.join(tmpDir, "docker-compose.yml"),
      "utf-8",
    );
    expect(compose).toContain("container_name: admin");
    expect(compose).toContain("build: ./admin");
    expect(compose).toContain("AUTH_MODE: server");
    expect(compose).toContain("- ./admin:/app");
  });

  it("builds a docker-auth compose file using the fetched env.example and oauth wiring", async () => {
    stubEnvExampleFetch("SOME_VAR=value\n");

    const shared = await generateDockerCompose(tmpDir, {
      authMode: "docker",
      adminMode: "image",
      includeAdmin: true,
      oauth: [googleProvider()],
    });

    const compose = fs.readFileSync(
      path.join(tmpDir, "docker-compose.yml"),
      "utf-8",
    );

    expect(compose).toContain(`image: ${SEAMLESS_AUTH_API_IMAGE}`);
    expect(compose).not.toContain("build:\n      context: ./auth");
    expect(compose).toContain(`API_SERVICE_TOKEN: "${shared.apiToken}"`);
    expect(compose).toContain(`API_SERVICE_TOKEN: ${shared.apiToken}`);
    expect(compose).toContain(`JWKS_KID: ${shared.kid}`);
    expect(compose).toContain("OAUTH_PROVIDERS");
  });
});
