import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as p from "@clack/prompts";
import kleur from "kleur";

type CheckStatus = "pass" | "fail" | "warn" | "info";

interface CheckItem {
  label: string;
  status: CheckStatus;
  detail?: string;
}

interface SeamlessConfig {
  projectName?: string;
  services?: {
    web?: { path?: string | null; image?: string | null };
    api?: { path?: string | null; image?: string | null };
    auth?: { path?: string | null; image?: string | null };
    admin?: { path?: string | null; image?: string | null };
  };
  docker?: {
    composeFile?: string;
  };
  deploy?: {
    tier?: string;
    region?: string;
    domain?: {
      webHost?: string;
      apiHost?: string;
      authHost?: string;
      adminHost?: string;
    };
  };
}

interface DeployManifest {
  region: string;
  tier: string;
  domain: {
    webHost: string;
    apiHost: string;
    authHost: string;
    adminHost: string;
  };
}

export async function runCheck() {
  const root = process.cwd();

  p.intro(kleur.cyan("Seamless Check"));

  const configPath = path.join(root, "seamless.config.json");
  if (!fs.existsSync(configPath)) {
    p.log.error("seamless.config.json not found");
    p.note("Run: seamless init", "Next step");
    p.outro(kleur.red("Check failed"));
    return;
  }

  const config = JSON.parse(
    fs.readFileSync(configPath, "utf-8"),
  ) as SeamlessConfig;

  const projectItems = checkProjectStructure(root, config);
  const toolItems = checkLocalTools();
  const localItems = await checkLocalRuntime(root, config);
  const deployItems = await checkDeployState(root);

  renderSection("Project", projectItems);
  renderSection("Local tools", toolItems);
  renderSection("Local runtime", localItems);
  renderSection("Deploy state", deployItems);

  const all = [...projectItems, ...toolItems, ...localItems, ...deployItems];
  const failCount = all.filter((item) => item.status === "fail").length;
  const warnCount = all.filter((item) => item.status === "warn").length;

  if (failCount > 0) {
    p.outro(
      kleur.red(
        `Check complete with ${failCount} failing check${failCount === 1 ? "" : "s"}`,
      ),
    );
    return;
  }

  if (warnCount > 0) {
    p.outro(
      kleur.yellow(
        `Check complete with ${warnCount} warning${warnCount === 1 ? "" : "s"}`,
      ),
    );
    return;
  }

  p.outro(kleur.green("Check complete"));
}

function renderSection(title: string, items: CheckItem[]) {
  console.log("");
  console.log(kleur.bold(title));

  for (const item of items) {
    console.log(`  ${formatStatus(item.status)} ${item.label}`);
    if (item.detail) {
      console.log(`    ${kleur.dim(item.detail)}`);
    }
  }
}

function formatStatus(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return kleur.green("●");
    case "fail":
      return kleur.red("●");
    case "warn":
      return kleur.yellow("●");
    default:
      return kleur.cyan("●");
  }
}

function pathExists(root: string, relativePath?: string | null): boolean {
  if (!relativePath) return false;
  return fs.existsSync(path.join(root, relativePath));
}

function checkProjectStructure(
  root: string,
  config: SeamlessConfig,
): CheckItem[] {
  const items: CheckItem[] = [];

  items.push({
    label: "Config file found",
    status: "pass",
    detail: "seamless.config.json",
  });

  const web = config.services?.web;
  const api = config.services?.api;
  const auth = config.services?.auth;
  const admin = config.services?.admin;

  items.push(checkServiceSourceOrImage(root, "Web", web));
  items.push(checkServiceSourceOrImage(root, "API", api));
  items.push(checkServiceSourceOrImage(root, "Auth", auth));
  items.push(checkServiceSourceOrImage(root, "Admin", admin));

  const composeFile = config.docker?.composeFile ?? "docker-compose.yml";
  const composePath = path.join(root, composeFile);

  items.push({
    label: "Docker Compose file",
    status: fs.existsSync(composePath) ? "pass" : "warn",
    detail: fs.existsSync(composePath)
      ? composeFile
      : `${composeFile} not found`,
  });

  return items;
}

function checkServiceSourceOrImage(
  root: string,
  name: string,
  service?: { path?: string | null; image?: string | null },
): CheckItem {
  if (!service) {
    return {
      label: `${name} service config`,
      status: "fail",
      detail: "Missing from seamless.config.json",
    };
  }

  if (service.path) {
    const exists = pathExists(root, service.path);
    return {
      label: `${name} source`,
      status: exists ? "pass" : "fail",
      detail: exists ? service.path : `Missing path: ${service.path}`,
    };
  }

  if (service.image) {
    return {
      label: `${name} image`,
      status: "pass",
      detail: service.image,
    };
  }

  return {
    label: `${name} service config`,
    status: "fail",
    detail: "No local path or image configured",
  };
}

function checkLocalTools(): CheckItem[] {
  return [
    checkCommand("docker", "Docker"),
    checkCommand("terraform", "Terraform"),
    checkCommand("aws", "AWS CLI"),
  ];
}

function checkCommand(command: string, label: string): CheckItem {
  try {
    execSync(`${command} --version`, { stdio: "ignore" });
    return {
      label: `${label} installed`,
      status: "pass",
    };
  } catch {
    return {
      label: `${label} installed`,
      status: "fail",
      detail: `${command} is not available on PATH`,
    };
  }
}

async function checkLocalRuntime(
  root: string,
  config: SeamlessConfig,
): Promise<CheckItem[]> {
  const items: CheckItem[] = [];

  const composeFile = config.docker?.composeFile ?? "docker-compose.yml";
  const composePath = path.join(root, composeFile);

  if (!fs.existsSync(composePath)) {
    items.push({
      label: "Local Docker runtime",
      status: "warn",
      detail: "Compose file missing, skipping local container checks",
    });
    return items;
  }

  try {
    const output = execSync("docker ps --format '{{.Names}}'").toString();

    const expected = ["api", "web", "admin", "seamless-auth", "seamless-db"];
    const running = expected.filter((name) => output.includes(name));

    items.push({
      label: "Docker containers",
      status: running.length > 0 ? "pass" : "warn",
      detail:
        running.length > 0
          ? `Running: ${running.join(", ")}`
          : "No expected local containers are running",
    });
  } catch {
    items.push({
      label: "Docker containers",
      status: "warn",
      detail: "Failed to inspect docker ps",
    });
  }

  const localHealthChecks = [
    { label: "Local API", url: "http://localhost:3000/" },
    { label: "Local Auth", url: "http://localhost:5312/health/status" },
    { label: "Local Admin", url: "http://localhost:5174" },
    { label: "Local Web", url: "http://localhost:5173" },
  ];

  for (const check of localHealthChecks) {
    items.push(await fetchCheck(check.label, check.url, true));
  }

  return items;
}

async function checkDeployState(root: string): Promise<CheckItem[]> {
  const items: CheckItem[] = [];

  const manifestPath = path.join(root, "infra", "deploy.json");
  const tfDir = path.join(root, "infra", "aws", "dev");
  const tfStatePath = path.join(tfDir, "terraform.tfstate");

  const manifestExists = fs.existsSync(manifestPath);
  const tfDirExists = fs.existsSync(tfDir);
  const tfStateExists = fs.existsSync(tfStatePath);

  items.push({
    label: "Deploy manifest",
    status: manifestExists ? "pass" : "warn",
    detail: manifestExists ? "infra/deploy.json" : "No deploy manifest found",
  });

  items.push({
    label: "Terraform directory",
    status: tfDirExists ? "pass" : "warn",
    detail: tfDirExists
      ? "infra/aws/dev"
      : "No generated Terraform directory found",
  });

  items.push({
    label: "Terraform state",
    status: tfStateExists ? "pass" : "warn",
    detail: tfStateExists
      ? "terraform.tfstate present"
      : "No terraform.tfstate found",
  });

  if (!manifestExists) {
    items.push({
      label: "Deployed endpoint checks",
      status: "info",
      detail: "Skipped because infra/deploy.json is missing",
    });
    return items;
  }

  let manifest: DeployManifest;
  try {
    manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8"),
    ) as DeployManifest;
  } catch {
    items.push({
      label: "Deploy manifest parse",
      status: "fail",
      detail: "infra/deploy.json is not valid JSON",
    });
    return items;
  }

  items.push({
    label: "Deploy tier",
    status: "info",
    detail: `${manifest.tier} in ${manifest.region}`,
  });

  items.push(
    await fetchCheck(
      "Deployed Web",
      `https://${manifest.domain.webHost}`,
      false,
    ),
  );
  items.push(
    await fetchCheck(
      "Deployed API",
      `https://${manifest.domain.apiHost}`,
      false,
    ),
  );
  items.push(
    await fetchCheck(
      "Deployed Auth",
      `https://${manifest.domain.authHost}/health/status`,
      false,
    ),
  );
  items.push(
    await fetchCheck(
      "Deployed Admin",
      `https://${manifest.domain.adminHost}`,
      false,
    ),
  );

  return items;
}

async function fetchCheck(
  label: string,
  url: string,
  warnOnFailure: boolean,
): Promise<CheckItem> {
  try {
    const res = await fetch(url);

    if (res.ok) {
      return {
        label,
        status: "pass",
        detail: `${url} returned ${res.status}`,
      };
    }

    return {
      label,
      status: warnOnFailure ? "warn" : "fail",
      detail: `${url} returned ${res.status}`,
    };
  } catch {
    return {
      label,
      status: warnOnFailure ? "warn" : "fail",
      detail: `${url} not reachable`,
    };
  }
}
