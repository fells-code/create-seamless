import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  accountKey,
  deleteTokens,
  getTokens,
  redactToken,
  saveTokens,
  scrubTokens,
  setBackendForTesting,
  type KeychainBackend,
  type TokenBundle,
} from "./keychain.js";

function fakeBackend(): KeychainBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: (account) => store.get(account) ?? null,
    set: (account, secret) => {
      store.set(account, secret);
    },
    delete: (account) => store.delete(account),
  };
}

const prod = { name: "prod", instanceUrl: "https://auth.example.com" };
const bundle: TokenBundle = {
  accessToken: "access-abc",
  refreshToken: "refresh-xyz",
  accessTokenExpiresAt: 1000,
  refreshTokenExpiresAt: 2000,
};

let backend: ReturnType<typeof fakeBackend>;

beforeEach(() => {
  backend = fakeBackend();
  setBackendForTesting(backend);
  delete process.env.SEAMLESS_REFRESH_TOKEN;
});

afterEach(() => {
  setBackendForTesting(null);
  delete process.env.SEAMLESS_REFRESH_TOKEN;
});

describe("accountKey", () => {
  it("scopes by profile name and instance URL", () => {
    expect(accountKey(prod)).toBe("prod::https://auth.example.com");
    expect(accountKey({ name: "prod", instanceUrl: "https://other.example.com" })).not.toBe(
      accountKey(prod),
    );
  });
});

describe("saveTokens / getTokens", () => {
  it("round-trips a token bundle", async () => {
    await saveTokens(prod, bundle);
    expect(await getTokens(prod)).toEqual(bundle);
  });

  it("keeps tokens for same-named profiles on different instances separate", async () => {
    const staging = { name: "prod", instanceUrl: "https://staging.example.com" };
    await saveTokens(prod, bundle);
    await saveTokens(staging, { accessToken: "a2", refreshToken: "r2" });

    expect((await getTokens(prod))?.refreshToken).toBe("refresh-xyz");
    expect((await getTokens(staging))?.refreshToken).toBe("r2");
    expect(backend.store.size).toBe(2);
  });

  it("returns null when nothing is stored", async () => {
    expect(await getTokens(prod)).toBeNull();
  });

  it("returns null on corrupt stored data", async () => {
    backend.set(accountKey(prod), "{ not json");
    expect(await getTokens(prod)).toBeNull();
  });
});

describe("SEAMLESS_REFRESH_TOKEN fallback", () => {
  it("returns the env refresh token without touching the keychain", async () => {
    process.env.SEAMLESS_REFRESH_TOKEN = "ci-refresh";
    setBackendForTesting({
      get: () => {
        throw new Error("keychain should not be read when env is set");
      },
      set: () => {},
      delete: () => false,
    });

    expect(await getTokens(prod)).toEqual({
      accessToken: "",
      refreshToken: "ci-refresh",
    });
  });
});

describe("deleteTokens", () => {
  it("clears a profile's entry", async () => {
    await saveTokens(prod, bundle);
    expect(await deleteTokens(prod)).toBe(true);
    expect(await getTokens(prod)).toBeNull();
  });

  it("reports false when there was nothing to delete", async () => {
    expect(await deleteTokens(prod)).toBe(false);
  });
});

describe("redaction", () => {
  it("redactToken never returns the secret", () => {
    expect(redactToken("super-secret-refresh-token")).toBe("[redacted]");
    expect(redactToken("")).toBe("(none)");
    expect(redactToken(undefined)).toBe("(none)");
  });

  it("scrubTokens masks token-like fields recursively", () => {
    const scrubbed = scrubTokens({
      email: "dev@example.com",
      token: "access-abc",
      nested: { refreshToken: "refresh-xyz", other: 1 },
      list: [{ Authorization: "Bearer x" }],
    });

    expect(scrubbed).toEqual({
      email: "dev@example.com",
      token: "[redacted]",
      nested: { refreshToken: "[redacted]", other: 1 },
      list: [{ Authorization: "[redacted]" }],
    });
  });
});
