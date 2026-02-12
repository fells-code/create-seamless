#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { pipeline } from "stream";
import { promisify } from "util";
import { createWriteStream } from "fs";
import AdmZip from "adm-zip";
import { randomBytes } from "crypto";

const streamPipeline = promisify(pipeline);

const MIN_NODE_MAJOR = 18;
const nodeMajor = Number(process.versions.node.split(".")[0]);

function printHelp() {
  console.log(`
create-seamless

Scaffold a local Seamless Auth development environment.

Usage:
  npx create-seamless [project-name] [options]

Options:
  --auth           Include the Seamless Auth server
  --api            Include the Express API example
  --web            Include the React web application
  --no-git         Skip git initialization

  --auth-port <n>  Auth server port (default: 5312)
  --api-port <n>   API server port (default: 3000)
  --web-port <n>   Web server port (default: 5173)

  -h, --help       Show this help message

If no component flags are provided, all components are included.

Docs:
  https://docs.seamlessauth.com
`);
}

if (nodeMajor < MIN_NODE_MAJOR) {
  console.error(`
❌ Seamless requires Node ${MIN_NODE_MAJOR}+.
You are running Node ${process.versions.node}

Upgrade at https://nodejs.org
`);
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help")) {
  printHelp();
  process.exit(0);
}
const projectName = args.find((a) => !a.startsWith("--")) ?? "seamless-app";

const hasFlag = (flag) => args.includes(`--${flag}`);
const getFlag = (flag, fallback) => {
  const i = args.indexOf(`--${flag}`);
  return i !== -1 ? args[i + 1] : fallback;
};

const includeAuth = hasFlag("auth");
const includeWeb = hasFlag("web");
const includeApi = hasFlag("api");
const skipGit = hasFlag("no-git");

const authPort = getFlag("auth-port", "5312");
const apiPort = getFlag("api-port", "3000");
const webPort = getFlag("web-port", "5001");

const wantsSomething = includeAuth || includeWeb || includeApi;
const AUTH = wantsSomething ? includeAuth : true;
const WEB = wantsSomething ? includeWeb : true;
const API = wantsSomething ? includeApi : true;

const REPOS = {
  auth: "fells-code/seamless-auth-api",
  web: "fells-code/seamless-auth-starter-react",
  api: "fells-code/seamless-auth-starter-express",
};

const GENERATED_README = (projectName) => `# ${projectName}

This project was generated with \`create-seamless\` and provides a fully local,
open source authentication stack built on **Seamless Auth**.

It is designed for development environments where you want:

- Passwordless authentication
- No hosted dependencies
- No redirects or third-party auth services
- A production-shaped local setup

---

## Project layout

\`\`\`text
.
├─ auth/                # Seamless Auth open source server
├─ api/                 # Backend API server (optional)
├─ web/                 # Frontend web application (optional)
├─ Docker-compose.yml   # Docker compose for one command spin up of dev environment
└─ README.md
\`\`\`

---

## Running the stack

### Running with Docker (optional)

This project includes a Docker Compose configuration that allows you to run the
entire Seamless Auth stack locally with a single command.

### Requirements

* Docker
* Docker Compose

### Start the stack

From the project root, run:

\`\`\`bash
docker compose up
\`\`\`

This will start the following services in development mode:

* Postgres database
* Seamless Auth server
* API server
* Web UI

All services are configured with hot reload. Changes to the source code will be
picked up automatically.

### Access the application

Once all services are running, open:

\`\`\`
http://localhost:5001
\`\`\`

This is the main entry point for the web application.

### Stopping the stack

To stop all services:

\`\`\`bash
docker compose down
\`\`\`

This will shut down all containers while preserving the local database volume.

Open separate terminals and run each service independently.

### Auth server

\`\`\`bash
cd auth
npm run dev
\`\`\`

Default port: \`5312\`

---

### API server

\`\`\`bash
cd api
npm run dev
\`\`\`

Default port: \`3000\`

---

### Web application

\`\`\`bash
cd web
npm run dev
\`\`\`

Default port: \`5001\`

---

## Documentation

Full Seamless Auth documentation:

https://seamlessauth.com/docs

---

## Included open source projects

- Seamless Auth Server  
  https://github.com/fells-code/seamless-auth-server

- Seamless Auth React Starter  
  https://github.com/fells-code/seamless-auth-starter-react

- Seamless Auth API Starter  
  https://github.com/fells-code/seamless-auth-starter-express

---

## License

This generated project inherits the licenses of the open source components it
includes.

Review each subproject for its specific license before deploying to production.
`;

const GENERATED_DOCKER_COMPOSE = `
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
      - ./postgres_init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myuser -d postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  auth:
    container_name: seamless-auth
    build: 
      context: ./auth
      dockerfile: Dockerfile.dev
    ports:
      - "${authPort}:${authPort}"
    env_file:
      - ./auth/.env
    environment:
      DB_HOST: db
      ISSUER: http://auth:${authPort}
    volumes:
      - ./auth:/app
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy

  api:
    container_name: seamless-api
    build: ./api
    ports:
      - "${apiPort}:${apiPort}"
    env_file:
      - ./api/.env
    environment:
      AUTH_SERVER_URL: http://auth:${authPort}
    volumes:
      - ./api:/app
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy

  web:
    container_name: seamless-web
    build: ./web
    ports:
      - "${webPort}:${webPort}"
    env_file:
      - ./web/.env
    volumes:
      - ./web:/app
      - /app/node_modules
    depends_on:
      - auth
      - api

volumes:
  pgdata:
`;

function writeEnv(dir, values) {
  const env = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(path.join(dir, ".env"), env + "\n");
}

async function downloadRepo(repo, dest) {
  const url = `https://codeload.github.com/${repo}/zip/refs/heads/main`;
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${repo}`);
  }

  const zipPath = path.join(dest, "_repo.zip");
  await streamPipeline(res.body, createWriteStream(zipPath));

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(dest, true);
  fs.unlinkSync(zipPath);

  const inner = fs.readdirSync(dest).find((f) => f.endsWith("-main"));
  if (!inner) throw new Error("Unexpected repo structure");

  const innerPath = path.join(dest, inner);
  for (const file of fs.readdirSync(innerPath)) {
    fs.renameSync(path.join(innerPath, file), path.join(dest, file));
  }
  fs.rmdirSync(innerPath);
}

(async () => {
  const root = path.join(process.cwd(), projectName);

  if (fs.existsSync(root)) {
    console.error("❌ Directory already exists.");
    process.exit(1);
  }

  fs.mkdirSync(root);

  console.log(`\nCreating Seamless project: ${projectName}\n`);
  const API_SERVICE_TOKEN = randomBytes(32).toString("hex");

  if (AUTH) {
    const dir = path.join(root, "auth");
    fs.mkdirSync(dir);
    console.log("Fetching Seamless Auth OSS...");
    await downloadRepo(REPOS.auth, dir);

    writeEnv(dir, {
      PORT: authPort,
      NODE_ENV: "development",

      VERSION: "1.0.0",
      APP_NAME: "Seamless Auth Example",
      APP_ID: "local-dev",
      APP_ORIGIN: `http://localhost:${apiPort}`,
      ISSUER: `http://localhost:${authPort}`,

      AUTH_MODE: "server",
      DEMO: "true",

      DEFAULT_ROLES: "user,betaUser",
      AVAILABLE_ROLES: "user,admin,betaUser,team",

      DB_LOGGING: "false",
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "seamless_auth",
      DB_USER: "myuser",
      DB_PASSWORD: "mypassword",

      ACCESS_TOKEN_TTL: "30m",
      REFRESH_TOKEN_TTL: "1h",
      RATE_LIMIT: "100",
      DELAY_AFTER: "50",

      API_SERVICE_TOKEN: API_SERVICE_TOKEN,

      JWKS_ACTIVE_KID: "dev-main",

      RPID: "localhost",
      ORIGINS: `http://localhost:${webPort}`,
    });
  }

  if (API) {
    const dir = path.join(root, "api");
    fs.mkdirSync(dir);
    console.log("Fetching API starter...");
    await downloadRepo(REPOS.api, dir);

    writeEnv(dir, {
      AUTH_SERVER_URL: `http://localhost:${authPort}`,
      APP_ORIGIN: `http://localhost:${apiPort}`,
      UI_ORIGIN: `http://localhost:${webPort}`,
      COOKIE_SIGNING_KEY: randomBytes(32).toString("hex"),
      API_SERVICE_TOKEN: API_SERVICE_TOKEN,

      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "seamless_api",
      DB_USER: "myuser",
      DB_PASSWORD: "mypassword",

      SQL_LOGGING: "false",
    });
  }

  if (WEB) {
    const dir = path.join(root, "web");
    fs.mkdirSync(dir);
    console.log("Fetching Web starter...");
    await downloadRepo(REPOS.web, dir);

    writeEnv(dir, {
      VITE_AUTH_SERVER_URL: `http://localhost:${apiPort}`,
      VITE_API_URL: `http://localhost:${apiPort}`,
      PORT: webPort,
    });
  }

  fs.writeFileSync(path.join(root, "README.md"), GENERATED_README(projectName));

  if (!skipGit) {
    execSync("git init", { cwd: root });
  }

  if (AUTH && API && WEB) {
    fs.writeFileSync(
      path.join(root, "Docker-compose.yml"),
      GENERATED_DOCKER_COMPOSE,
    );
  }

  const pgDir = path.join(root, "postgres_init");
  fs.mkdirSync(pgDir);
  fs.writeFileSync(
    path.join(pgDir, "init.sql"),
    `
CREATE DATABASE seamless_auth;
CREATE DATABASE seamless_api;
    `,
  );

  console.log(`
╔════════════════════════════════════════╗
║          S E A M L E S S               ║
╚════════════════════════════════════════╝

Your local auth stack is ready.

Start development:

  cd ${projectName}

  # terminal 1
  cd auth && npm i && npm run dev

  # terminal 2
  cd api && npm i && npm run dev

  # terminal 3
  cd web && npm i && npm run dev

  or if using Docker

  docker compose up

Docs: https://docs.seamlessauth.com/docs
Happy hacking. 🚀
`);
})().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
