import fs from "node:fs";
import path from "node:path";
import { getDeployManifestPath } from "./paths.js";
import {
  ResolvedDeployAnswers,
  SeamlessConfig,
  ServiceConfig,
} from "./deployConfig.js";
import {
  DeploySecretBundle,
  buildDeploySecretBundle,
} from "./deploySecrets.js";

export type DeployEnvKind = "plain" | "secret";
export type DeployEnvOwner = "deploy" | "user";
export type DeployEnvTarget = "task_definition" | "ssm" | "secrets_manager";
export type DeployServiceName = "web" | "api" | "auth" | "admin";

export interface DeployEnvVar {
  key: string;
  value: string;
  kind: DeployEnvKind;
  owner: DeployEnvOwner;
  target: DeployEnvTarget;
  source: "env" | "env_example" | "prompt" | "derived";
}

export interface DeployServiceEnvMap {
  web: DeployEnvVar[];
  api: DeployEnvVar[];
  auth: DeployEnvVar[];
  admin: DeployEnvVar[];
}

export type DeployServiceMode = "source" | "image";

export interface DeployManifest {
  version: 1;
  projectName: string;
  provider: "aws";
  tier: "dev" | "standard" | "enterprise";
  region: string;
  awsProfile: string;
  env: DeployServiceEnvMap;
  domain: {
    root: string;
    hostedZoneDomain?: string;
    hostedZoneId?: string;
    webHost: string;
    apiHost: string;
    authHost: string;
    adminHost: string;
  };
  backup: {
    enabled: boolean;
    schedule: "hourly" | "daily" | "weekly";
    retentionDays: number;
  };
  services: {
    web: {
      mode: DeployServiceMode;
      path: string | null;
      image: string | null;
    };
    api: {
      mode: DeployServiceMode;
      path: string | null;
      image: string | null;
    };
    auth: {
      mode: DeployServiceMode;
      path: string | null;
      image: string | null;
    };
    admin: {
      mode: DeployServiceMode;
      path: string | null;
      image: string | null;
    };
  };
  images: {
    web: { repositoryName: string; tag: string };
    api: { repositoryName: string; tag: string };
    auth: { repositoryName: string; tag: string };
    admin: { repositoryName: string; tag: string };
    postgres: { repositoryName: string; tag: string };
  };
  runtime: {
    apiOrigin: string;
    authIssuer: string;
    webOrigin: string;
    adminOrigin: string;
    acmCertificateArn?: string;
    rpid: string;
    secrets: DeploySecretBundle;
  };
}

function emptyEnvMap(): DeployServiceEnvMap {
  return {
    web: [],
    api: [],
    auth: [],
    admin: [],
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePath(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

function normalizeImage(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

function resolveServiceMode(
  service: ServiceConfig | undefined,
  fallback: DeployServiceMode = "source",
): DeployServiceMode {
  const hasPath = Boolean(normalizePath(service?.path));
  const hasImage = Boolean(normalizeImage(service?.image));

  if (hasPath) return "source";
  if (hasImage) return "image";
  return fallback;
}

function buildServiceEntry(
  service: ServiceConfig | undefined,
  fallback: DeployServiceMode = "source",
): { mode: DeployServiceMode; path: string | null; image: string | null } {
  const normalizedPath = normalizePath(service?.path);
  const normalizedImage = normalizeImage(service?.image);
  const mode = resolveServiceMode(service, fallback);

  if (mode === "source" && !normalizedPath) {
    throw new Error("A source-backed service is missing a local path");
  }

  if (mode === "image" && !normalizedImage) {
    throw new Error("An image-backed service is missing an image reference");
  }

  return {
    mode,
    path: normalizedPath,
    image: normalizedImage,
  };
}

function buildOrigins(answers: ResolvedDeployAnswers) {
  return {
    webOrigin: `https://${answers.domain.webHost}`,
    apiOrigin: `https://${answers.domain.apiHost}`,
    authIssuer: `https://${answers.domain.authHost}`,
    adminOrigin: `https://${answers.domain.adminHost}`,
  };
}

function resolveSecrets(existing?: DeployManifest | null): DeploySecretBundle {
  if (existing?.runtime?.secrets) {
    return existing.runtime.secrets;
  }
  return buildDeploySecretBundle();
}

export function readDeployManifest(projectDir: string): DeployManifest {
  const filePath = getDeployManifestPath(projectDir);

  if (!fs.existsSync(filePath)) {
    throw new Error("Missing infra/deploy.json");
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as DeployManifest;
}

export function readExistingDeployManifest(
  projectDir: string,
): DeployManifest | null {
  const filePath = getDeployManifestPath(projectDir);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as DeployManifest;
}

export function buildDeployManifest(
  config: SeamlessConfig,
  answers: ResolvedDeployAnswers,
  existing?: DeployManifest | null,
): DeployManifest {
  const slug = slugify(config.projectName);
  const secrets = resolveSecrets(existing);
  const { webOrigin, apiOrigin, authIssuer, adminOrigin } =
    buildOrigins(answers);

  return {
    version: 1,
    projectName: config.projectName,
    provider: "aws",
    tier: answers.tier,
    region: answers.region,
    awsProfile: answers.awsProfile,
    domain: {
      root: answers.domain.root,
      hostedZoneDomain: answers.domain.hostedZoneDomain,
      hostedZoneId: answers.domain.hostedZoneId,
      webHost: answers.domain.webHost,
      apiHost: answers.domain.apiHost,
      authHost: answers.domain.authHost,
      adminHost: answers.domain.adminHost,
    },
    backup: {
      enabled: answers.backup.enabled,
      schedule: answers.backup.schedule,
      retentionDays: answers.backup.retentionDays,
    },
    services: {
      web: buildServiceEntry(config.services.web, "source"),
      api: buildServiceEntry(config.services.api, "source"),
      auth: buildServiceEntry(config.services.auth, "image"),
      admin: buildServiceEntry(config.services.admin, "image"),
    },
    images: {
      web: { repositoryName: `${slug}-web`, tag: "latest" },
      api: { repositoryName: `${slug}-api`, tag: "latest" },
      auth: { repositoryName: `${slug}-auth`, tag: "latest" },
      admin: { repositoryName: `${slug}-admin`, tag: "latest" },
      postgres: { repositoryName: `${slug}-postgres`, tag: "latest" },
    },
    env: existing?.env ?? emptyEnvMap(),
    runtime: {
      apiOrigin,
      authIssuer,
      webOrigin,
      adminOrigin,
      acmCertificateArn: existing?.runtime?.acmCertificateArn,
      rpid: answers.domain.root,
      secrets,
    },
  };
}

export function writeDeployManifest(
  projectDir: string,
  manifest: DeployManifest,
): void {
  const filePath = getDeployManifestPath(projectDir);
  const dirPath = path.dirname(filePath);

  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function updateDeployManifestCertificateArn(
  projectDir: string,
  certificateArn: string,
): DeployManifest {
  const existing = readDeployManifest(projectDir);

  const updated: DeployManifest = {
    ...existing,
    runtime: {
      ...existing.runtime,
      acmCertificateArn: certificateArn,
    },
  };

  writeDeployManifest(projectDir, updated);
  return updated;
}

export function updateDeployManifestEnv(
  projectDir: string,
  env: DeployServiceEnvMap,
): DeployManifest {
  const existing = readDeployManifest(projectDir);

  const updated: DeployManifest = {
    ...existing,
    env,
  };

  writeDeployManifest(projectDir, updated);
  return updated;
}
