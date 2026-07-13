import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getConfigPath,
  getProfile,
  listProfiles,
  loadConfig,
  normalizeInstanceUrl,
  removeProfile,
  resolveActiveProfileName,
  setActiveProfile,
  upsertProfile,
} from "./config.js";

let configHome: string;

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-config-"));
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.SEAMLESS_PROFILE;
});

afterEach(() => {
  fs.rmSync(configHome, { recursive: true, force: true });
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.SEAMLESS_PROFILE;
});

describe("loadConfig", () => {
  it("returns an empty config when no file exists", () => {
    expect(loadConfig()).toEqual({ activeProfile: "default", profiles: {} });
  });

  it("persists profiles across invocations", () => {
    upsertProfile({ name: "prod", instanceUrl: "https://auth.example.com" });
    expect(getProfile("prod")?.instanceUrl).toBe("https://auth.example.com");
    expect(listProfiles()).toHaveLength(1);
  });

  it("throws a clear error on malformed JSON", () => {
    fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
    fs.writeFileSync(getConfigPath(), "{ not json");
    expect(() => loadConfig()).toThrow(/not valid JSON/);
  });
});

describe("upsertProfile", () => {
  it("makes the first profile active and stores no secrets", () => {
    upsertProfile({
      name: "prod",
      instanceUrl: "https://auth.example.com",
      email: "dev@example.com",
      sub: "user-123",
      identifierType: "email",
    });

    const onDisk = JSON.parse(fs.readFileSync(getConfigPath(), "utf-8"));
    expect(onDisk.activeProfile).toBe("prod");

    const keys = Object.keys(onDisk.profiles.prod).sort();
    expect(keys).toEqual(["email", "identifierType", "instanceUrl", "name", "sub"]);
    expect(JSON.stringify(onDisk)).not.toMatch(/token/i);
  });

  it("does not steal the active profile from an existing one", () => {
    upsertProfile({ name: "prod", instanceUrl: "https://a.example.com" });
    upsertProfile({ name: "staging", instanceUrl: "https://b.example.com" });
    expect(loadConfig().activeProfile).toBe("prod");
  });
});

describe("setActiveProfile / removeProfile", () => {
  it("switches the active profile", () => {
    upsertProfile({ name: "prod", instanceUrl: "https://a.example.com" });
    upsertProfile({ name: "staging", instanceUrl: "https://b.example.com" });
    setActiveProfile("staging");
    expect(loadConfig().activeProfile).toBe("staging");
  });

  it("rejects switching to an unknown profile", () => {
    expect(() => setActiveProfile("ghost")).toThrow(/does not exist/);
  });

  it("reassigns the active profile when the active one is removed", () => {
    upsertProfile({ name: "prod", instanceUrl: "https://a.example.com" });
    upsertProfile({ name: "staging", instanceUrl: "https://b.example.com" });
    removeProfile("prod");
    expect(loadConfig().activeProfile).toBe("staging");
  });

  it("rejects removing an unknown profile", () => {
    expect(() => removeProfile("ghost")).toThrow(/does not exist/);
  });
});

describe("resolveActiveProfileName", () => {
  beforeEach(() => {
    upsertProfile({ name: "prod", instanceUrl: "https://a.example.com" });
    setActiveProfile("prod");
  });

  it("prefers the flag over env and persisted value", () => {
    process.env.SEAMLESS_PROFILE = "fromEnv";
    expect(resolveActiveProfileName({ profileFlag: "fromFlag" })).toBe("fromFlag");
  });

  it("uses the env var when no flag is given", () => {
    process.env.SEAMLESS_PROFILE = "fromEnv";
    expect(resolveActiveProfileName({})).toBe("fromEnv");
  });

  it("falls back to the persisted active profile", () => {
    expect(resolveActiveProfileName({})).toBe("prod");
  });
});

describe("normalizeInstanceUrl", () => {
  it("strips a trailing slash", () => {
    expect(normalizeInstanceUrl("https://auth.example.com/")).toBe(
      "https://auth.example.com",
    );
  });

  it("preserves a base path without a trailing slash", () => {
    expect(normalizeInstanceUrl("https://auth.example.com/base/")).toBe(
      "https://auth.example.com/base",
    );
  });

  it("allows http for localhost", () => {
    expect(normalizeInstanceUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(normalizeInstanceUrl("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("rejects http for a non-local host", () => {
    expect(() => normalizeInstanceUrl("http://auth.example.com")).toThrow(
      /must use https/,
    );
  });

  it("rejects a value without a scheme", () => {
    expect(() => normalizeInstanceUrl("auth.example.com")).toThrow(/Invalid/);
  });

  it("rejects an empty value", () => {
    expect(() => normalizeInstanceUrl("  ")).toThrow(/required/);
  });
});
