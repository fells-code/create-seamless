import { DeployServiceName } from "./deployManifest.js";

const DEPLOY_MANAGED_KEYS: Record<DeployServiceName, Set<string>> = {
  web: new Set(["API_URL", "VITE_API_URL"]),
  admin: new Set(["API_URL", "AUTH_MODE", "VITE_API_URL", "VITE_AUTH_MODE"]),
  api: new Set([
    "AUTH_SERVER_URL",
    "APP_ORIGIN",
    "UI_ORIGINS",
    "COOKIE_SIGNING_KEY",
    "API_SERVICE_TOKEN",
    "JWKS_KID",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "SQL_LOGGING",
  ]),
  auth: new Set([
    "NODE_ENV",
    "VERSION",
    "APP_NAME",
    "APP_ID",
    "APP_ORIGIN",
    "ISSUER",
    "AUTH_MODE",
    "DEMO",
    "DEFAULT_ROLES",
    "AVAILABLE_ROLES",
    "DB_LOGGING",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "ACCESS_TOKEN_TTL",
    "REFRESH_TOKEN_TTL",
    "RATE_LIMIT",
    "DELAY_AFTER",
    "API_SERVICE_TOKEN",
    "JWKS_ACTIVE_KID",
    "SEAMLESS_JWKS_ACTIVE_KID",
    "JWKS_PUBLIC_KEYS",
    "RPID",
    "ORIGINS",
    "SEAMLESS_BOOTSTRAP_ENABLED",
    "SEAMLESS_BOOTSTRAP_SECRET",
  ]),
};

export function isDeployManagedKey(
  service: DeployServiceName,
  key: string,
): boolean {
  if (DEPLOY_MANAGED_KEYS[service].has(key)) return true;

  if (service === "auth" && key.startsWith("SEAMLESS_JWKS_KEY_")) return true;

  return false;
}

export function inferEnvKind(key: string): "plain" | "secret" {
  const upper = key.toUpperCase();

  const secretHints = [
    "SECRET",
    "TOKEN",
    "PASSWORD",
    "PRIVATE",
    "WEBHOOK",
    "KEY",
    "DSN",
  ];

  const alwaysPlainPrefixes = ["VITE_PUBLIC_", "NEXT_PUBLIC_", "PUBLIC_"];

  if (alwaysPlainPrefixes.some((prefix) => upper.startsWith(prefix))) {
    return "plain";
  }

  if (secretHints.some((hint) => upper.includes(hint))) {
    return "secret";
  }

  return "plain";
}
