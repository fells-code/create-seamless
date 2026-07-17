import { describe, expect, it } from "vitest";
import {
  buildOAuthAuthEnv,
  OAUTH_PROVIDER_CATALOG,
  withLoginMethod,
  type CollectedOAuthProvider,
} from "./oauthProviders.js";

function collected(
  id: string,
  clientId: string,
  clientSecret: string,
): CollectedOAuthProvider {
  const catalog = OAUTH_PROVIDER_CATALOG.find((p) => p.id === id);
  if (!catalog) throw new Error(`unknown test provider ${id}`);
  return { catalog, clientId, clientSecret };
}

describe("OAUTH_PROVIDER_CATALOG", () => {
  it("contains the four supported providers", () => {
    expect(OAUTH_PROVIDER_CATALOG.map((p) => p.id)).toEqual([
      "google",
      "github",
      "microsoft",
      "gitlab",
    ]);
  });

  it("does not include Apple", () => {
    expect(OAUTH_PROVIDER_CATALOG.some((p) => p.id === "apple")).toBe(false);
  });
});

describe("buildOAuthAuthEnv", () => {
  it("returns empty env/pending for no providers, but still sets shared keys", () => {
    const { env, pending } = buildOAuthAuthEnv([]);

    expect(pending).toEqual([]);
    expect(JSON.parse(env.OAUTH_PROVIDERS)).toEqual([]);
    expect(env.OAUTH_STATE_SECRET).toMatch(/^[0-9a-f]{64}$/);
  });

  it("marks a fully-credentialed provider enabled with no pending entry", () => {
    const { env, pending } = buildOAuthAuthEnv([
      collected("google", "client-123", "secret-456"),
    ]);

    expect(pending).toEqual([]);
    expect(env.GOOGLE_CLIENT_SECRET).toBe("secret-456");

    const configs = JSON.parse(env.OAUTH_PROVIDERS);
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({
      id: "google",
      name: "Google",
      enabled: true,
      clientId: "client-123",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scopes: ["openid", "email", "profile"],
      redirectUri: "http://localhost:5173/oauth/callback",
      redirectUris: ["http://localhost:5173/oauth/callback"],
      pkce: true,
    });
  });

  it("marks a provider missing the client id as disabled and pending, with a placeholder id", () => {
    const { env, pending } = buildOAuthAuthEnv([
      collected("github", "", "secret-456"),
    ]);

    expect(pending).toEqual(["GitHub"]);
    const configs = JSON.parse(env.OAUTH_PROVIDERS);
    expect(configs[0].enabled).toBe(false);
    expect(configs[0].clientId).toBe("REPLACE_WITH_GITHUB_CLIENT_ID");
    // github has extra claim-path overrides and no pkce flag
    expect(configs[0].subjectJsonPath).toBe("id");
    expect(configs[0].nameJsonPath).toBe("name");
    expect(configs[0].pkce).toBeUndefined();
  });

  it("marks a provider missing the client secret as disabled and pending", () => {
    const { env, pending } = buildOAuthAuthEnv([
      collected("microsoft", "client-only", ""),
    ]);

    expect(pending).toEqual(["Microsoft"]);
    expect(env.MICROSOFT_CLIENT_SECRET).toBe("");
    const configs = JSON.parse(env.OAUTH_PROVIDERS);
    expect(configs[0].enabled).toBe(false);
    expect(configs[0].clientId).toBe("client-only");
  });

  it("handles multiple providers, replacing dashes in the secret env name", () => {
    const { env, pending } = buildOAuthAuthEnv([
      collected("google", "g-id", "g-secret"),
      collected("gitlab", "", ""),
    ]);

    expect(pending).toEqual(["GitLab"]);
    expect(env.GOOGLE_CLIENT_SECRET).toBe("g-secret");
    expect(env.GITLAB_CLIENT_SECRET).toBe("");

    const configs = JSON.parse(env.OAUTH_PROVIDERS);
    expect(configs).toHaveLength(2);
    expect(configs[1].clientSecretEnv).toBe("GITLAB_CLIENT_SECRET");
  });
});

describe("withLoginMethod", () => {
  it("defaults to passkey,magic_link when current is undefined and appends the method", () => {
    expect(withLoginMethod(undefined, "oauth")).toBe(
      "passkey,magic_link,oauth",
    );
  });

  it("appends the method to an existing list", () => {
    expect(withLoginMethod("passkey", "oauth")).toBe("passkey,oauth");
  });

  it("does not duplicate a method that is already present", () => {
    expect(withLoginMethod("passkey,oauth", "oauth")).toBe("passkey,oauth");
  });

  it("trims whitespace and drops empty entries", () => {
    expect(withLoginMethod(" passkey , , oauth ", "magic_link")).toBe(
      "passkey,oauth,magic_link",
    );
  });

  it("treats an empty string as current as having no existing methods (nullish coalescing does not apply)", () => {
    expect(withLoginMethod("", "oauth")).toBe("oauth");
  });
});
