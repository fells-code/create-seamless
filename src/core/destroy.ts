import fs from "node:fs";
import path from "node:path";
import { DeployManifest } from "./deployManifest.js";
import {
  getAwsDevInfraDir,
  getDeployManifestPath,
  getInfraDir,
} from "./paths.js";
import { deleteEcrImages, deleteEcrRepository } from "./aws.js";

export async function destroyEcrResources(
  manifest: DeployManifest,
): Promise<void> {
  const repositories = [
    manifest.images.web.repositoryName,
    manifest.images.api.repositoryName,
    manifest.images.postgres.repositoryName,
  ];

  if (manifest.services.auth.mode === "source") {
    repositories.push(manifest.images.auth.repositoryName);
  }

  if (manifest.services.admin.mode === "source") {
    repositories.push(manifest.images.admin.repositoryName);
  }

  for (const repositoryName of repositories) {
    await deleteEcrImages(manifest.awsProfile, manifest.region, repositoryName);
    await deleteEcrRepository(
      manifest.awsProfile,
      manifest.region,
      repositoryName,
    );
  }
}

export function removeGeneratedInfraFiles(projectDir: string): void {
  const manifestPath = getDeployManifestPath(projectDir);
  const awsDevDir = getAwsDevInfraDir(projectDir);

  if (fs.existsSync(manifestPath)) {
    fs.rmSync(manifestPath, { force: true });
  }

  if (fs.existsSync(awsDevDir)) {
    fs.rmSync(awsDevDir, { recursive: true, force: true });
  }

  const infraDir = getInfraDir(projectDir);
  if (fs.existsSync(infraDir)) {
    const remaining = fs.readdirSync(infraDir);
    if (remaining.length === 0) {
      fs.rmSync(infraDir, { recursive: true, force: true });
    }
  }
}
