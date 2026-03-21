import fs from "fs";
import path from "path";
import { fetchEnvExample } from "../../core/fetch.js";
import { parseEnv, parseEnvString } from "../../core/env.js";
import { generateKid, generateSecret } from "../../core/secrets.js";
import { generateJWKS } from "../../core/jwks.js";

export async function generateDockerCompose(
  root: string,
  options: {
    authMode: "local" | "docker";
    includeApi: boolean | Symbol;
    includeWeb: boolean | Symbol;
  },
) {
  const compose = await buildCompose(options, root);

  fs.writeFileSync(
    path.join(root, "docker-compose.yml"),
    compose.trim() + "\n",
  );

  console.log("Docker compose created.");
}

async function buildCompose(options: any, root: string) {
  const { authMode, includeApi, includeWeb } = options;

  const { service: authBlock, shared } = await authService(authMode, root);

  return `
services:
  db:
    image: postgres:16
    container_name: seamless-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

${authBlock}

${includeApi ? apiService(shared) : ""}

${includeWeb ? webService() : ""}

volumes:
  pgdata:
`;
}

async function authService(mode: "local" | "docker", root: string) {
  if (mode === "local") {
    return {
      service: `
  auth:
    container_name: seamless-auth
    build:
      context: ./auth
      dockerfile: Dockerfile.dev
    ports:
      - "5312:5312"
    env_file:
      - ./auth/.env
    environment:
      DB_HOST: db
      ISSUER: http://auth:5312
    volumes:
      - ./auth:/app
      - /app/node_modules
    depends_on:
      - db
`,
      shared: extractSharedFromLocalEnv(root),
    };
  }

  return await authServiceDocker();
}
function apiService(shared: any) {
  return `
  api:
    container_name: api
    build: ./api
    ports:
      - "3000:3000"
    env_file:
      - ./api/.env
    environment:
      AUTH_SERVER_URL: http://auth:5312
      UI_ORIGIN: http://localhost:5173
      DB_HOST: db
      API_SERVICE_TOKEN: ${shared.apiToken}
      JWKS_KID: ${shared.kid}
    volumes:
      - ./api:/app
      - /app/node_modules
    depends_on:
      - db
      - auth
`;
}

function webService() {
  return `
  web:
    container_name: web
    build: ./web
    ports:
      - "5173:5173"
    env_file:
      - ./web/.env
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_AUTH_SERVER_URL: http://localhost:3000/
    volumes:
      - ./web:/app
      - /app/node_modules
    depends_on:
      - auth
      - api
`;
}

async function authServiceDocker() {
  const raw = await fetchEnvExample();
  const parsed = parseEnvString(raw);

  const { env, shared } = buildAuthEnv(parsed, "docker");

  const envBlock = envToDockerBlock(env);

  return {
    service: `
  auth:
    image: ghcr.io/fells-code/seamless-auth-api:v0.1.4
    container_name: seamless-auth
    ports:
      - "5312:5312"
    environment:
${envBlock}
    depends_on:
      - db
`,
    shared,
  };
}

export function buildAuthEnv(
  env: Record<string, string>,
  mode: "local" | "docker",
) {
  const apiToken = generateSecret(32);
  const kid = generateKid();

  env.PORT = "5312";

  env.NODE_ENV = mode === "docker" ? "production" : "development";

  env.AUTH_MODE = "server";
  env.ISSUER = "http://auth:5312";

  env.DB_HOST = "db";
  env.DB_PORT = "5432";

  env.API_SERVICE_TOKEN = apiToken;

  const jwks = buildJWKSConfig();

  env.SEAMLESS_JWKS_ACTIVE_KID = jwks.kid;
  env.JWKS_ACTIVE_KID = jwks.kid;

  env[`SEAMLESS_JWKS_KEY_${jwks.kid}_PRIVATE`] = jwks.privateKey;

  env.JWKS_PUBLIC_KEYS = jwks.publicJwksJson;

  env.APP_ORIGIN = "http://localhost:5173";
  env.ORIGINS = "http://localhost:5173";

  return {
    env,
    shared: {
      apiToken,
      kid,
    },
  };
}

export function envToDockerBlock(env: Record<string, string>) {
  return Object.entries(env)
    .map(([k, v]) => {
      if (v.includes("\n")) {
        return `      ${k}: |\n${indentMultiline(v, 8)}`;
      }

      return `      ${k}: ${v}`;
    })
    .join("\n");
}

function indentMultiline(value: string, spaces: number) {
  const indent = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

export function extractSharedFromLocalEnv(root: string) {
  const authEnvPath = path.join(root, "auth", ".env");

  if (!fs.existsSync(authEnvPath)) {
    throw new Error("Auth .env file not found. Cannot extract shared config.");
  }

  const env = parseEnv(authEnvPath);

  const apiToken = env.API_SERVICE_TOKEN;
  const kid = env.JWKS_ACTIVE_KID;

  if (!apiToken || !kid) {
    throw new Error(
      "Missing API_SERVICE_TOKEN or JWKS_ACTIVE_KID in auth .env",
    );
  }

  return {
    apiToken,
    kid,
  };
}

export function buildJWKSConfig() {
  const kid = "main";

  const { publicKey, privateKey } = generateJWKS();

  return {
    kid,
    privateKey,
    publicKey,
    publicJwksJson: JSON.stringify(
      {
        keys: [
          {
            kid,
            pem: publicKey.replace(/\n/g, "\\n"),
          },
        ],
      },
      null,
      2,
    ),
  };
}
