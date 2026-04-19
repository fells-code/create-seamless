import fs from "node:fs";
import path from "node:path";
import { DeployManifest } from "./deployManifest.js";
import { getAwsDevInfraDir } from "./paths.js";

export interface AwsDevTfvars {
  project_name: string;
  aws_region: string;
  aws_profile: string;
  root_domain: string;
  hosted_zone_domain: string;
  acm_certificate_arn: string;
  web_host: string;
  api_host: string;
  auth_host: string;
  admin_host: string;
  backup_enabled: boolean;
  backup_retention_days: number;
  web_image: string;
  api_image: string;
  auth_image: string;
  admin_image: string;
  postgres_image: string;

  api_origin: string;
  auth_issuer: string;
  web_origin: string;
  admin_origin: string;
  rpid: string;

  api_service_token: string;
  cookie_signing_key: string;
  bootstrap_secret: string;

  auth_db_user: string;
  auth_db_password: string;
  auth_db_name: string;

  api_db_user: string;
  api_db_password: string;
  api_db_name: string;

  jwks_active_kid: string;
  seamless_jwks_active_kid: string;
  jwks_private_key: string;
  jwks_public_keys: string;
}

function getTfvarsPath(projectDir: string): string {
  return path.join(getAwsDevInfraDir(projectDir), "terraform.tfvars.json");
}

export function buildAwsDevTfvars(manifest: DeployManifest): AwsDevTfvars {
  return {
    project_name: manifest.projectName,
    aws_region: manifest.region,
    aws_profile: manifest.awsProfile,
    root_domain: manifest.domain.root,
    hosted_zone_domain:
      manifest.domain.hostedZoneDomain ?? manifest.domain.root,
    acm_certificate_arn: manifest.runtime.acmCertificateArn ?? "",
    web_host: manifest.domain.webHost,
    api_host: manifest.domain.apiHost,
    auth_host: manifest.domain.authHost,
    admin_host: manifest.domain.adminHost,
    backup_enabled: manifest.backup.enabled,
    backup_retention_days: manifest.backup.retentionDays,
    web_image: "REPLACE_WEB_IMAGE_URI",
    api_image: "REPLACE_API_IMAGE_URI",
    auth_image: "REPLACE_AUTH_IMAGE_URI",
    admin_image: "REPLACE_ADMIN_IMAGE_URI",
    postgres_image: "REPLACE_POSTGRES_IMAGE_URI",

    api_origin: manifest.runtime.apiOrigin,
    auth_issuer: manifest.runtime.authIssuer,
    web_origin: manifest.runtime.webOrigin,
    admin_origin: manifest.runtime.adminOrigin,
    rpid: manifest.runtime.rpid,

    api_service_token: manifest.runtime.secrets.apiServiceToken,
    cookie_signing_key: manifest.runtime.secrets.cookieSigningKey,
    bootstrap_secret: manifest.runtime.secrets.bootstrapSecret,

    auth_db_user: manifest.runtime.secrets.authDbUser,
    auth_db_password: manifest.runtime.secrets.authDbPassword,
    auth_db_name: manifest.runtime.secrets.authDbName,

    api_db_user: manifest.runtime.secrets.apiDbUser,
    api_db_password: manifest.runtime.secrets.apiDbPassword,
    api_db_name: manifest.runtime.secrets.apiDbName,

    jwks_active_kid: manifest.runtime.secrets.jwks.kid,
    seamless_jwks_active_kid: manifest.runtime.secrets.jwks.kid,
    jwks_private_key: manifest.runtime.secrets.jwks.privateKey,
    jwks_public_keys: manifest.runtime.secrets.jwks.publicJwksJson,
  };
}

export function writeAwsDevTfvars(
  projectDir: string,
  tfvars: AwsDevTfvars,
): void {
  const outPath = getTfvarsPath(projectDir);
  fs.writeFileSync(outPath, `${JSON.stringify(tfvars, null, 2)}\n`, "utf8");
}

export function readAwsDevTfvars(projectDir: string): AwsDevTfvars {
  const tfvarsPath = getTfvarsPath(projectDir);
  const raw = fs.readFileSync(tfvarsPath, "utf8");
  return JSON.parse(raw) as AwsDevTfvars;
}

export function updateAwsDevTfvarsImages(
  projectDir: string,
  images: Pick<
    AwsDevTfvars,
    "web_image" | "api_image" | "auth_image" | "admin_image" | "postgres_image"
  >,
): void {
  const current = readAwsDevTfvars(projectDir);

  writeAwsDevTfvars(projectDir, {
    ...current,
    ...images,
  });
}

export function updateAwsDevTfvarsCertificateArn(
  projectDir: string,
  acmCertificateArn: string,
): void {
  const current = readAwsDevTfvars(projectDir);

  writeAwsDevTfvars(projectDir, {
    ...current,
    acm_certificate_arn: acmCertificateArn,
  });
}
