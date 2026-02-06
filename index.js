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

if (nodeMajor < MIN_NODE_MAJOR) {
  console.error(`
❌ Seamless requires Node ${MIN_NODE_MAJOR}+.
You are running Node ${process.versions.node}

Upgrade at https://nodejs.org
`);
  process.exit(1);
}

const args = process.argv.slice(2);
const projectName = args.find((a) => !a.startsWith("--")) ?? "seamless-app";

const hasFlag = (flag) => args.includes(`--${flag}`);
const getFlag = (flag, fallback) => {
  const i = args.indexOf(`--${flag}`);
  return i !== -1 ? args[i + 1] : fallback;
};

const includeAuth = hasFlag("auth");
const includeWeb = hasFlag("web");
const includeApi = hasFlag("api");
const installDeps = hasFlag("install");
const skipGit = hasFlag("no-git");

const authPort = getFlag("auth-port", "5312");
const apiPort = getFlag("api-port", "3000");
const webPort = getFlag("web-port", "5173");

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
├─ auth/        # Seamless Auth open source server
├─ api/         # Backend API server (optional)
├─ web/         # Frontend web application (optional)
└─ README.md
\`\`\`

---

## Running the stack

Open separate terminals and run each service independently.

### Auth server

\`\`\`bash
cd auth
npm run dev
\`\`\`

Default port: \`3000\`

---

### API server

\`\`\`bash
cd api
npm run dev
\`\`\`

Default port: \`4000\`

---

### Web application

\`\`\`bash
cd web
npm run dev
\`\`\`

Default port: \`5173\`

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
      APP_ORIGIN: "http://localhost:3000",
      ISSUER: "http://localhost:5312",

      AUTH_MODE: "server",
      DEMO: "true",

      DEFAULT_ROLES: "user,betaUser",
      AVAILABLE_ROLES: "user,admin,betaUser,team",

      DATABASE_URL: "postgres://myuser:mypassword@localhost:5432/seamless-auth",

      ACCESS_TOKEN_TTL: "30m",
      REFRESH_TOKEN_TTL: "1h",
      RATE_LIMIT: "100",
      DELAY_AFTER: "50",

      API_SERVICE_TOKEN: API_SERVICE_TOKEN,

      JWKS_ACTIVE_KID: "dev-main",

      RPID: "localhost",
      ORIGINS: "http://localhost:3000",
    });
  }

  if (API) {
    const dir = path.join(root, "api");
    fs.mkdirSync(dir);
    console.log("Fetching API starter...");
    await downloadRepo(REPOS.api, dir);

    writeEnv(dir, {
      AUTH_SERVER_URL: `http://localhost${authPort}`,
      APP_ORIGIN: `http://localhost:${apiPort}`,
      COOKIE_SIGNING_KEY: randomBytes(32).toString("hex"),
      API_SERVICE_TOKEN: API_SERVICE_TOKEN,
      DATABASE_URL: `postgres://myuser:mypassword@localhost:5432/seamless`,
      DB_NAME: "seamless",
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

  if (installDeps) {
    for (const dir of ["auth", "api", "web"]) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) {
        console.log(`Installing deps in ${dir}...`);
        execSync("npm install", { cwd: full, stdio: "inherit" });
      }
    }
  }

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

Docs: https://docs.seamlessauth.com/docs
Happy hacking. 🚀
`);
})().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
