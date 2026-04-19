import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import { cwd } from "node:process";
import { discoverAndResolveCustomEnv } from "../core/envDiscovery.js";
import {
  mergeDeployConfig,
  readSeamlessConfig,
  validateRequiredServices,
  writeSeamlessConfig,
} from "../core/deployConfig.js";
import {
  buildDeployManifest,
  readExistingDeployManifest,
  updateDeployManifestCertificateArn,
  updateDeployManifestEnv,
  writeDeployManifest,
} from "../core/deployManifest.js";
import { getAwsIdentity } from "../core/aws.js";
import { buildAndPushImages } from "../core/buildPush.js";
import { runPostDeployHealthChecks } from "../core/health.js";
import { ensureRequiredCommands } from "../core/preReqs.js";
import {
  terraformApply,
  terraformInit,
  terraformOutput,
  terraformPlan,
} from "../core/terraform.js";
import {
  buildAwsDevTfvars,
  updateAwsDevTfvarsCertificateArn,
  updateAwsDevTfvarsImages,
  writeAwsDevTfvars,
} from "../core/tfVars.js";
import { generateAwsDevInfra } from "../generators/deploy/aws/dev/files.js";
import { promptDeploySetup } from "../prompts/deploySetup.js";
import { ensureAcmCertificate } from "../core/acm.js";

interface DeployOptions {
  cwd?: string;
}

export async function deploy(options: DeployOptions = {}): Promise<void> {
  const projectDir = options.cwd ? path.resolve(options.cwd) : cwd();

  const setup = p.spinner();
  setup.start("Loading project configuration");

  let config;
  try {
    config = readSeamlessConfig(projectDir);
    validateRequiredServices(config);
    setup.stop("Project configuration loaded");
  } catch (error) {
    setup.stop("Failed to load project configuration");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const answers = await promptDeploySetup(config);

  if (answers.tier !== "dev") {
    p.log.warn(
      `Tier "${answers.tier}" is not implemented yet. Continuing with dev-oriented flow.`,
    );
  }

  const prereqs = p.spinner();
  prereqs.start("Validating local deployment prerequisites");

  try {
    await ensureRequiredCommands();
    prereqs.stop("Prerequisites validated");
  } catch (error) {
    prereqs.stop("Prerequisite validation failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const persist = p.spinner();
  persist.start("Saving deployment settings");

  try {
    const updated = mergeDeployConfig(config, answers);
    writeSeamlessConfig(projectDir, updated);
    persist.stop("Deployment settings saved");
  } catch (error) {
    persist.stop("Failed to save deployment settings");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const existingManifest = readExistingDeployManifest(projectDir);
  let manifest = buildDeployManifest(config, answers, existingManifest);

  const generate = p.spinner();
  generate.start("Generating deployment manifest and Terraform files");

  try {
    writeDeployManifest(projectDir, manifest);
    generateAwsDevInfra(projectDir, manifest);
    writeAwsDevTfvars(projectDir, buildAwsDevTfvars(manifest));
    generate.stop("Deployment files generated");
  } catch (error) {
    generate.stop("Failed to generate deployment files");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const envs = p.spinner();
  envs.start("Discovering custom application environment variables");

  try {
    const resolvedEnv = await discoverAndResolveCustomEnv(projectDir, manifest);
    manifest = updateDeployManifestEnv(projectDir, resolvedEnv);
    generateAwsDevInfra(projectDir, manifest);
    writeAwsDevTfvars(projectDir, buildAwsDevTfvars(manifest));
    envs.stop("Custom environment variables resolved");
  } catch (error) {
    envs.stop("Failed to resolve custom environment variables");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const account = p.spinner();
  account.start("Resolving AWS account identity");

  let identity;
  try {
    identity = await getAwsIdentity(answers.awsProfile, answers.region);
    account.stop(`Using AWS account ${identity.accountId}`);
  } catch (error) {
    account.stop("Failed to resolve AWS account identity");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const certificate = p.spinner();
  certificate.start("Requesting and validating ACM certificate");

  try {
    const certificateArn = await ensureAcmCertificate(manifest);
    manifest = updateDeployManifestCertificateArn(projectDir, certificateArn);
    updateAwsDevTfvarsCertificateArn(projectDir, certificateArn);
    certificate.stop("ACM certificate issued");
  } catch (error) {
    certificate.stop("ACM certificate setup failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const images = p.spinner();
  images.start("Ensuring ECR repositories and pushing container images");

  try {
    const imageUris = await buildAndPushImages(
      projectDir,
      manifest,
      identity.accountId,
    );
    updateAwsDevTfvarsImages(projectDir, imageUris);
    images.stop("Images built and pushed");
  } catch (error) {
    images.stop("Image build or push failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const infra = p.spinner();
  infra.start("Applying Terraform infrastructure");

  try {
    await terraformInit(projectDir);
    //await terraformPlan(projectDir);
    await terraformApply(projectDir);
    infra.stop("Infrastructure applied");
  } catch (error) {
    infra.stop("Terraform apply failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const output = p.spinner();
  output.start("Reading deployment outputs");

  let webUrl = "";
  let apiUrl = "";
  let authUrl = "";
  let adminUrl = "";

  try {
    webUrl = await terraformOutput(projectDir, "web_url");
    apiUrl = await terraformOutput(projectDir, "api_url");
    authUrl = await terraformOutput(projectDir, "auth_url");
    adminUrl = await terraformOutput(projectDir, "admin_url");
    output.stop("Deployment outputs ready");
  } catch (error) {
    output.stop("Failed to read Terraform outputs");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(message);
    process.exit(1);
  }

  const health = p.spinner();
  health.start("Running post-deploy health checks");

  try {
    await runPostDeployHealthChecks({
      web: webUrl,
      api: apiUrl,
      auth: authUrl,
      admin: adminUrl,
    });
    health.stop("Health checks passed");
  } catch (error) {
    health.stop("Health checks failed");
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.warn(message);
  }

  p.note(
    [
      `Web: ${webUrl}`,
      `API: ${apiUrl}`,
      `Auth: ${authUrl}`,
      `Admin: ${adminUrl}`,
    ].join("\n"),
    "Deployment complete",
  );

  p.outro(pc.green("Seamless deploy finished."));
}
