import fs from "node:fs";
import path from "node:path";
import {
  buildAwsDevTfvars,
  writeAwsDevTfvars,
} from "../../../../core/tfVars.js";
import { DeployManifest } from "../../../../core/deployManifest.js";
import { getAwsDevInfraDir, getInfraDir } from "../../../../core/paths.js";
import {
  renderAcmTf,
  renderAlbTf,
  renderBackupTf,
  renderEcsTf,
  renderEc2Tf,
  renderIamTf,
  renderLogsTf,
  renderMainTf,
  renderNetworkingTf,
  renderOutputsTf,
  renderPostgresDockerfile,
  renderPostgresInitSql,
  renderRoute53Tf,
  renderS3Tf,
  renderVariablesTf,
} from "./template.js";

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, `${content.trim()}\n`, "utf8");
}

export function generateAwsDevInfra(
  projectDir: string,
  manifest: DeployManifest,
): void {
  const infraDir = getInfraDir(projectDir);
  const awsDevDir = getAwsDevInfraDir(projectDir);
  const postgresDir = path.join(awsDevDir, "postgres");

  ensureDir(infraDir);
  ensureDir(awsDevDir);
  ensureDir(postgresDir);

  writeFile(path.join(awsDevDir, "main.tf"), renderMainTf());
  writeFile(path.join(awsDevDir, "variables.tf"), renderVariablesTf(manifest));
  writeFile(path.join(awsDevDir, "networking.tf"), renderNetworkingTf());
  writeFile(path.join(awsDevDir, "acm.tf"), renderAcmTf());
  writeFile(path.join(awsDevDir, "route53.tf"), renderRoute53Tf());
  writeFile(path.join(awsDevDir, "alb.tf"), renderAlbTf());
  writeFile(path.join(awsDevDir, "logs.tf"), renderLogsTf(manifest));
  writeFile(path.join(awsDevDir, "s3.tf"), renderS3Tf());
  writeFile(path.join(awsDevDir, "iam.tf"), renderIamTf());
  writeFile(path.join(awsDevDir, "ec2.tf"), renderEc2Tf());
  writeFile(path.join(awsDevDir, "ecs.tf"), renderEcsTf(manifest));
  writeFile(path.join(awsDevDir, "backup.tf"), renderBackupTf());
  writeFile(path.join(awsDevDir, "outputs.tf"), renderOutputsTf());

  writeFile(path.join(postgresDir, "Dockerfile"), renderPostgresDockerfile());
  writeFile(
    path.join(postgresDir, "init.sql"),
    renderPostgresInitSql(manifest),
  );

  writeAwsDevTfvars(projectDir, buildAwsDevTfvars(manifest));
}
