import fs from "fs";
import path from "path";
import { runCommand } from "../../core/exec.js";
import { writeEnv } from "../../utils/writeEnv.js";

const AUTH_REPO = "https://github.com/fells-code/seamless-auth-api";
const AUTH_PORT = 5312;

export async function generateAuthServer(
  context: any,
  mode: "local" | "docker" | Symbol,
) {
  const { root } = context;

  if (mode === "local") {
    await setupLocalAuth(root);
  } else {
    await setupDockerAuth(root);
  }
}

async function setupLocalAuth(root: string) {
  const authDir = path.join(root, "auth");

  console.log("Cloning SeamlessAuth server...");

  await runCommand("git", ["clone", AUTH_REPO, "auth"], root);

  console.log("Writing auth environment...");

  writeEnv(authDir, {
    PORT: AUTH_PORT,
    NODE_ENV: "development",
    AUTH_MODE: "server",
    ISSUER: `http://localhost:${AUTH_PORT}`,
  });

  console.log("Auth server ready in /auth");
}

async function setupDockerAuth(root: string) {
  console.log("Creating docker-compose for SeamlessAuth...");

  const dockerCompose = `
services:
  auth:
    image: ghcr.io/fells-code/seamless-auth-api:v0.1.2
    container_name: seamless-auth
    ports:
      - "5312:5312"
    environment:
      PORT: 5312
      NODE_ENV: development
      AUTH_MODE: server
      ISSUER: http://localhost:5312
`;

  fs.writeFileSync(
    path.join(root, "docker-compose.yml"),
    dockerCompose.trim() + "\n",
  );

  console.log("Docker setup ready.");
}
