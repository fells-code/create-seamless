import fs from "fs";
import path from "path";

export type DeployTier = "dev" | "standard" | "enterprise";
export type DeployProvider = "aws";
export type BackupSchedule = "hourly" | "daily" | "weekly";

export interface ServiceConfig {
  framework?: string;
  path?: string | null;
  mode?: string;
  image?: string | null;
}

export interface DomainConfig {
  root: string;
  webHost: string;
  apiHost: string;
  authHost: string;
  adminHost: string;
  hostedZoneDomain?: string;
  hostedZoneId?: string;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: BackupSchedule;
  retentionDays: number;
  bucketName?: string;
}

export interface DeployConfig {
  provider?: DeployProvider;
  tier?: DeployTier;
  region?: string;
  awsProfile?: string;
  domain?: DomainConfig;
  backup?: BackupConfig;
}

export interface SeamlessConfig {
  version: string;
  projectName: string;
  services: {
    web: ServiceConfig;
    api: ServiceConfig;
    auth?: ServiceConfig;
    admin?: ServiceConfig;
  };
  deploy?: DeployConfig;
}

export interface ResolvedDeployAnswers {
  provider: DeployProvider;
  tier: DeployTier;
  region: string;
  awsProfile: string;
  domain: DomainConfig;
  backup: BackupConfig;
}

export function getSeamlessConfigPath(projectDir: string): string {
  return path.join(projectDir, "seamless.config.json");
}

export function readSeamlessConfig(projectDir: string): SeamlessConfig {
  const configPath = getSeamlessConfigPath(projectDir);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing seamless.config.json in ${projectDir}`);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as SeamlessConfig;
}

export function writeSeamlessConfig(
  projectDir: string,
  config: SeamlessConfig,
): void {
  const configPath = getSeamlessConfigPath(projectDir);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function mergeDeployConfig(
  config: SeamlessConfig,
  deploy: ResolvedDeployAnswers,
): SeamlessConfig {
  return {
    ...config,
    deploy: {
      provider: deploy.provider,
      tier: deploy.tier,
      region: deploy.region,
      awsProfile: deploy.awsProfile,
      domain: deploy.domain,
      backup: deploy.backup,
    },
  };
}

export function validateRequiredServices(config: SeamlessConfig): void {
  const missing: string[] = [];

  if (!config.services.web) missing.push("web");
  if (!config.services.api) missing.push("api");
  if (!config.services.auth) missing.push("auth");
  if (!config.services.admin) missing.push("admin");

  if (missing.length > 0) {
    throw new Error(
      `Project is missing required services for deploy: ${missing.join(", ")}`,
    );
  }
}

export function buildDefaultDomainConfig(
  root: string,
  hostedZoneDomain?: string,
  hostedZoneId?: string,
): DomainConfig {
  return {
    root,
    webHost: root,
    apiHost: `api.${root}`,
    authHost: `auth.${root}`,
    adminHost: `admin.${root}`,
    hostedZoneDomain: hostedZoneDomain ?? root,
    hostedZoneId,
  };
}

export function getExistingDeployDefaults(
  config: SeamlessConfig,
): Partial<ResolvedDeployAnswers> {
  return {
    provider: config.deploy?.provider ?? "aws",
    tier: config.deploy?.tier,
    region: config.deploy?.region,
    awsProfile: config.deploy?.awsProfile,
    domain: config.deploy?.domain,
    backup: config.deploy?.backup,
  };
}
