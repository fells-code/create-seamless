import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import { cwd } from "node:process";
import { readSeamlessConfig } from "../core/deployConfig.js";
import { readDeployManifest } from "../core/deployManifest.js";
import {
  removeGeneratedInfraFiles,
  destroyEcrResources,
} from "../core/destroy.js";
import { ensureRequiredCommands } from "../core/preReqs.js";
import { terraformDestroy, terraformOutput } from "../core/terraform.js";
import { emptyVersionedS3Bucket } from "../core/aws.js";

interface DestroyOptions {
  cwd?: string;
}

export async function destroy(options: DestroyOptions = {}): Promise<void> {
  const projectDir = options.cwd ? path.resolve(options.cwd) : cwd();

  const load = p.spinner();
  load.start("Loading deployment state");

  let projectName = "unknown-project";
  let manifest;
  let backupBucketName = "";

  try {
    backupBucketName = await terraformOutput(projectDir, "backup_bucket_name");
  } catch {}

  try {
    const config = readSeamlessConfig(projectDir);
    projectName = config.projectName;
    manifest = readDeployManifest(projectDir);
    load.stop("Deployment state loaded");
  } catch (error) {
    load.stop("Failed to load deployment state");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  p.note(
    [
      `Project: ${projectName}`,
      `Region: ${manifest.region}`,
      `Web: https://${manifest.domain.webHost}`,
      `API: https://${manifest.domain.apiHost}`,
      `Auth: https://${manifest.domain.authHost}`,
      `Admin: https://${manifest.domain.adminHost}`,
      `Terraform: infra/aws/dev`,
      `ECR cleanup: enabled`,
    ].join("\n"),
    "Destroy summary",
  );

  const confirmed = await p.confirm({
    message:
      "This will destroy deployed infrastructure and delete managed ECR repositories. Continue?",
    initialValue: false,
  });

  if (backupBucketName) {
    const deleteBackups = await p.confirm({
      message: `Permanently delete all objects and versions in backup bucket "${backupBucketName}"?`,
      initialValue: false,
    });

    if (p.isCancel(deleteBackups) || !deleteBackups) {
      p.cancel(
        "Destroy cancelled because backup bucket deletion was not confirmed",
      );
      process.exit(0);
    }
  }

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Destroy cancelled");
    process.exit(0);
  }

  const prereqs = p.spinner();
  prereqs.start("Validating destroy prerequisites");

  try {
    await ensureRequiredCommands();
    prereqs.stop("Destroy prerequisites validated");
  } catch (error) {
    prereqs.stop("Destroy prerequisite validation failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  if (backupBucketName) {
    const bucket = p.spinner();
    bucket.start(`Emptying backup bucket ${backupBucketName}`);

    try {
      await emptyVersionedS3Bucket(
        manifest.awsProfile,
        manifest.region,
        backupBucketName,
      );
      bucket.stop("Backup bucket emptied");
    } catch (error) {
      bucket.stop("Failed to empty backup bucket");
      const message = error instanceof Error ? error.message : "Unknown error";
      p.log.warn(message);
    }
  }

  const tf = p.spinner();
  tf.start("Destroying Terraform-managed infrastructure");

  try {
    await terraformDestroy(projectDir);
    tf.stop("Terraform-managed infrastructure destroyed");
  } catch (error) {
    tf.stop("Terraform destroy failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.warn(message);
  }

  const ecr = p.spinner();
  ecr.start("Deleting managed ECR repositories");

  try {
    await destroyEcrResources(manifest);
    ecr.stop("Managed ECR repositories deleted");
  } catch (error) {
    ecr.stop("ECR cleanup failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.warn(message);
  }

  const local = p.spinner();
  local.start("Removing generated local deploy artifacts");

  try {
    removeGeneratedInfraFiles(projectDir);
    local.stop("Generated local deploy artifacts removed");
  } catch (error) {
    local.stop("Local cleanup failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.warn(message);
  }

  p.outro(pc.green("Seamless destroy finished."));
}
