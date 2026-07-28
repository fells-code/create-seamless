import fs from "fs";
import path from "path";
import { parseEnvString } from "../../core/env.js";
import { runCommand } from "../../core/exec.js";
import { fetchEnvExample } from "../../core/fetch.js";
import { POSTGRES_IMAGE, SEAMLESS_AUTH_API_IMAGE } from "../../core/images.js";
import {
  buildAuthEnv,
  configureAuthLocalEnv,
  envToDockerBlock,
} from "../docker/docker.js";
import type { CollectedOAuthProvider } from "../../core/oauthProviders.js";
import type { AdminMode } from "../docker/docker.js";

const AUTH_REPO = "https://github.com/fells-code/seamless-auth-api";

export async function generateAuthServer(
  context: any,
  mode: "local" | "docker" | Symbol,
  oauth: CollectedOAuthProvider[] = [],
  adminMode: AdminMode = "api",
  ownerEmail?: string,
) {
  const { root } = context;

  if (mode === "local") {
    return await setupLocalAuth(root, oauth, adminMode, ownerEmail);
  }

  return await setupDockerAuth(root);
}

async function setupLocalAuth(
  root: string,
  oauth: CollectedOAuthProvider[] = [],
  adminMode: AdminMode = "api",
  ownerEmail?: string,
) {
  const authDir = path.join(root, "auth");

  console.log("Cloning SeamlessAuth server...");

  await runCommand("git", ["clone", AUTH_REPO, "auth"], root);

  console.log("Writing auth environment...");

  const shared = await configureAuthLocalEnv(root, oauth, adminMode, ownerEmail);

  console.log("Auth server ready in /auth");
  return shared;
}

async function setupDockerAuth(root: string) {
  console.log("Creating docker-compose for SeamlessAuth...");

  const raw = await fetchEnvExample();
  const parsed = parseEnvString(raw);
  const { env, shared } = buildAuthEnv(parsed, "docker");
  const envBlock = envToDockerBlock(env);

  const dockerCompose = `
services:
  db:
    image: ${POSTGRES_IMAGE}
    container_name: seamless-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myuser -d postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  auth:
    image: ${SEAMLESS_AUTH_API_IMAGE}
    container_name: seamless-auth
    ports:
      - "5312:5312"
    environment:
${envBlock}
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
`;

  fs.writeFileSync(
    path.join(root, "docker-compose.yml"),
    dockerCompose.trim() + "\n",
  );

  console.log("Docker setup ready.");
  return shared;
}
