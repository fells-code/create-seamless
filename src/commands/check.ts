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

  console.log("✔ Config file found");

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  checkStructure(root, config);
  checkDocker();
  checkCompose(root, config);
  checkContainers();
  await checkHealth();

  console.log("\nCheck complete.\n");
}

function checkStructure(root: string, config: any) {
  const services = config.services;

  if (fs.existsSync(path.join(root, services.web.path))) {
    console.log("✔ Web project detected");
  } else {
    console.log("✖ Web project missing");
  }

  if (fs.existsSync(path.join(root, services.api.path))) {
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
  const composePath = path.join(root, config.docker.composeFile);

  if (fs.existsSync(composePath)) {
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

async function checkHealth() {
  const checks = [
    { name: "API", url: "http://localhost:3000/" },
    { name: "Auth", url: "http://localhost:5312/health/status" },
    { name: "Admin", url: "http://localhost:5174" },
  ];

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
