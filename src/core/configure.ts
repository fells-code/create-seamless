import path from "path";
import fs from "fs";
import { parseEnv, writeEnv } from "./env.js";
import { generateSecret } from "./secrets.js";

export function configureApiEnv(root: string, shared: any) {
  const apiEnvPath = path.join(root, "api", ".env");

  if (!fs.existsSync(apiEnvPath)) return;

  const env = parseEnv(apiEnvPath);

  env.AUTH_SERVER_URL = "http://localhost:5312";
  env.API_SERVICE_TOKEN = shared.apiToken;
  env.JWKS_KID = shared.kid;
  env.COOKIE_SIGNING_KEY = generateSecret(32);

  writeEnv(apiEnvPath, env);
}

export function configureWebEnv(root: string) {
  const webEnvPath = path.join(root, "web", ".env");

  if (!fs.existsSync(webEnvPath)) return;

  const env = parseEnv(webEnvPath);

  env.VITE_AUTH_SERVER_URL = "http://localhost:5312";
  env.VITE_API_URL = "http://localhost:3000";

  writeEnv(webEnvPath, env);
}
