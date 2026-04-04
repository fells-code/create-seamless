import fs from "fs";
import path from "path";
import { fetchEnvExample } from "../../core/fetch.js";
import { parseEnv, parseEnvString } from "../../core/env.js";
import { generateSecret } from "../../core/secrets.js";
import { generateJWKS } from "../../core/jwks.js";

export async function generateDockerCompose(
  root: string,
  options: {
    authMode: "local" | "docker";
    adminMode: "image" | "source";
    includeAdmin: boolean | symbol;
  },
) {
  const { compose, shared } = await buildCompose(options, root);

  fs.writeFileSync(
    path.join(root, "docker-compose.yml"),
    compose.trim() + "\n",
  );

  console.log("Docker compose created.");
  return shared;
}

async function buildCompose(
  options: {
    authMode: "local" | "docker";
    adminMode: "image" | "source";
    includeAdmin: boolean | symbol;
  },
  root: string,
) {
  const { authMode, adminMode, includeAdmin } = options;

  const { service: authBlock, shared } = await authService(authMode, root);

  return {
    compose: `
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

${apiService(shared)}

${webService()}

${includeAdmin ? adminService(adminMode) : ""}

volumes:
  pgdata:
`,
    shared,
  };
}
async function authService(mode: "local" | "docker", root: string) {
  if (mode === "local") {
    const shared = await configureAuthLocalEnv(root);

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
      shared,
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
      UI_ORIGINS: http://localhost:5173,http://localhost:5174
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
      - "5173:80"
    environment:
      API_URL: http://localhost:3000/
    volumes:
      - ./web:/app
      - /app/node_modules
    depends_on:
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
    image: ghcr.io/fells-code/seamless-auth-api:latest
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

function adminService(mode: "image" | "source") {
  if (mode === "source") {
    return `
  admin:
    container_name: admin
    build: ./admin
    ports:
      - "5174:80"
    environment:
      API_URL: http://localhost:3000/
      AUTH_MODE: server
    volumes:
      - ./admin:/app
      - /app/node_modules
    depends_on:
      - api
`;
  }

  return `
  admin:
    image: ghcr.io/fells-code/seamless-auth-admin-dashboard:latest
    container_name: admin
    ports:
      - "5174:80"
    environment:
      API_URL: http://localhost:3000/
    depends_on:
      - api
`;
}

function buildAuthEnv(env: Record<string, string>, mode: "local" | "docker") {
  const apiToken = generateSecret(32);
  const bootstrapSecret = generateSecret(32);

  env.SEAMLESS_BOOTSTRAP_ENABLED = "true";
  env.SEAMLESS_BOOTSTRAP_SECRET = bootstrapSecret;

  env.PORT = "5312";
  env.NODE_ENV = "development";

  env.AUTH_MODE = "server";
  env.ISSUER = "http://auth:5312";

  env.DB_HOST = mode === "docker" ? "db" : "localhost";
  env.DB_PORT = "5432";

  env.API_SERVICE_TOKEN = apiToken;

  let kid = "main";
  env.JWKS_ACTIVE_KID = kid;

  if (mode === "docker") {
    const jwks = buildJWKSConfig();

    kid = jwks.kid;

    env.SEAMLESS_JWKS_ACTIVE_KID = jwks.kid;
    env.JWKS_ACTIVE_KID = jwks.kid;

    env[`SEAMLESS_JWKS_KEY_${jwks.kid}_PRIVATE`] = jwks.privateKey;
    env.JWKS_PUBLIC_KEYS = jwks.publicJwksJson;
  }

  env.APP_ORIGINS = "http://localhost:3000";
  env.ORIGINS = "http://localhost:5173";

  return {
    env,
    shared: {
      apiToken,
      kid,
      bootstrapSecret,
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
            pem: publicKey,
          },
        ],
      },
      null,
      2,
    ),
  };
}

export async function configureAuthLocalEnv(root: string) {
  const authDir = path.join(root, "auth");
  const envExamplePath = path.join(authDir, ".env.example");
  const envPath = path.join(authDir, ".env");

  if (!fs.existsSync(envExamplePath)) {
    throw new Error(".env.example not found in auth directory");
  }

  const raw = fs.readFileSync(envExamplePath, "utf-8");

  const parsed = parseEnvString(raw);

  const { env, shared } = buildAuthEnv(parsed, "local");

  writeEnvFile(envPath, env);

  return shared;
}

function writeEnvFile(filePath: string, env: Record<string, string>) {
  const content = Object.entries(env)
    .map(([k, v]) => {
      if (v.includes("\n")) {
        return `${k}="${escapeMultiline(v)}"`;
      }
      return `${k}=${v}`;
    })
    .join("\n");

  fs.writeFileSync(filePath, content + "\n");
}

function escapeMultiline(value: string) {
  return value.replace(/\n/g, "\\n");
}

export function extractSharedFromExistingEnv(root: string) {
  const env = parseEnv(path.join(root, "auth", ".env"));

  return {
    apiToken: env.API_SERVICE_TOKEN,
    kid: env.JWKS_ACTIVE_KID || "main",
  };
}
