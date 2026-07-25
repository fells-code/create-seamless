import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export async function runCheck() {
  console.log("\nSeamless Check\n");

  const root = process.cwd();

  const configPath = path.join(root, "seamless.config.json");

  if (!fs.existsSync(configPath)) {
    console.log("✖ seamless.config.json not found");
    console.log("→ Run: seamless init\n");
    return;
  }

  let config: any;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    console.log("✖ seamless.config.json is not valid JSON");
    console.log("→ Fix the file, or re-run: seamless init\n");
    return;
  }

  console.log("✔ Config file found");

  checkStructure(root, config);

  // Managed projects run the auth server remotely and ship no compose file, so the
  // Docker/container checks don't apply — validate the remote instance instead.
  if (config?.services?.auth?.mode === "managed") {
    await checkManaged(config);
  } else {
    checkDocker();
    checkCompose(root, config);
    checkContainers();
    await checkHealth(config);
  }

  console.log("\nCheck complete.\n");
}

function checkStructure(root: string, config: any) {
  const services = config?.services ?? {};

  const webPath = services.web?.path;
  if (webPath && fs.existsSync(path.join(root, webPath))) {
    console.log("✔ Web project detected");
  } else {
    console.log("✖ Web project missing");
  }

  const apiPath = services.api?.path;
  if (apiPath && fs.existsSync(path.join(root, apiPath))) {
    console.log("✔ API project detected");
  } else {
    console.log("✖ API project missing");
  }
}

function checkDocker() {
  try {
    execSync("docker --version", { stdio: "ignore" });
    console.log("✔ Docker is installed");
  } catch {
    console.log("✖ Docker not found");
    console.log("→ Install Docker: https://docs.docker.com/get-docker/");
  }
}

function checkCompose(root: string, config: any) {
  const composeFile = config?.docker?.composeFile;

  if (composeFile && fs.existsSync(path.join(root, composeFile))) {
    console.log("✔ Docker Compose file found");
  } else {
    console.log("✖ docker-compose.yml missing");
  }
}

function checkContainers() {
  try {
    const output = execSync("docker ps --format '{{.Names}}'").toString();

    if (!output.includes("api")) {
      console.log("✖ API container not running");
      console.log("→ Run: docker compose up\n");
    } else {
      console.log("✔ Containers running");
    }
  } catch {
    console.log("✖ Failed to check containers");
  }
}

// The console lives at a different URL per hosting mode: proxied by the API at
// /console, or a standalone container on 5174. "none"/"hosted" projects have no
// local console to probe.
function consoleHealthCheck(config: any): { name: string; url: string } | null {
  const admin = config?.services?.admin;
  const mode = admin?.mode;
  if (mode === "api") {
    return { name: "Console", url: admin.url || "http://localhost:3000/console" };
  }
  if (mode === "image" || mode === "source") {
    return { name: "Console", url: "http://localhost:5174" };
  }
  return null;
}

async function checkHealth(config: any) {
  const checks = [
    { name: "API", url: "http://localhost:3000/" },
    { name: "Auth", url: "http://localhost:5312/health/status" },
  ];

  const consoleCheck = consoleHealthCheck(config);
  if (consoleCheck) checks.push(consoleCheck);

  for (const check of checks) {
    try {
      const res = await fetch(check.url);
      if (res.ok) {
        console.log(`✔ ${check.name} is healthy`);
      } else {
        console.log(`✖ ${check.name} returned ${res.status}`);
      }
    } catch {
      console.log(`✖ ${check.name} not reachable`);
    }
  }
}

async function checkManaged(config: any) {
  const auth = config?.services?.auth ?? {};
  const instanceUrl: string | undefined = auth.instanceUrl;

  console.log(
    "✔ Managed instance: " +
      (auth.applicationName || instanceUrl || "(unknown)"),
  );

  if (!instanceUrl) {
    console.log("✖ No managed instance URL recorded in seamless.config.json");
    return;
  }

  const healthUrl = `${instanceUrl.replace(/\/$/, "")}/health/status`;
  try {
    const res = await fetch(healthUrl);
    if (res.ok) {
      console.log("✔ Auth instance reachable");
    } else {
      console.log(`✖ Auth instance returned ${res.status}`);
    }
  } catch {
    console.log("✖ Auth instance not reachable");
  }

  console.log(
    "→ Managed project: the auth server runs remotely, so Docker and compose checks are skipped.",
  );
}
