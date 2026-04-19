import path from "node:path";
import { spawn } from "node:child_process";
import { execCommand } from "./exec.js";
import {
  buildEcrImageUri,
  buildEcrRegistry,
  ensureEcrRepositories,
  getEcrLoginPassword,
} from "./aws.js";
import { DeployManifest } from "./deployManifest.js";
import { getAwsDevInfraDir } from "./paths.js";

export interface BuiltImageUris {
  web_image: string;
  api_image: string;
  auth_image: string;
  admin_image: string;
  postgres_image: string;
}

async function dockerLogin(registry: string, password: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "docker",
      ["login", "--username", "AWS", "--password-stdin", registry],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if ((code ?? 0) !== 0) {
        reject(new Error(`Docker login failed: ${stderr}`));
        return;
      }
      resolve();
    });

    child.stdin.write(password);
    child.stdin.end();
  });
}

async function buildAndPushOne(
  buildDir: string,
  imageUri: string,
): Promise<void> {
  await execCommand("docker", ["build", "-t", imageUri, "."], {
    cwd: buildDir,
  });

  await execCommand("docker", ["push", imageUri], {
    cwd: buildDir,
  });
}

function requireServicePath(
  service: { path: string | null; mode: "source" | "image" },
  name: string,
): string {
  if (!service.path) {
    throw new Error(
      `${name} service is source-backed but no local path was configured`,
    );
  }
  return service.path;
}

function requireServiceImage(
  service: { image: string | null; mode: "source" | "image" },
  name: string,
): string {
  if (!service.image) {
    throw new Error(
      `${name} service is image-backed but no image reference was configured`,
    );
  }
  return service.image;
}

export async function buildAndPushImages(
  projectDir: string,
  manifest: DeployManifest,
  accountId: string,
): Promise<BuiltImageUris> {
  const reposToEnsure = [
    manifest.images.web.repositoryName,
    manifest.images.api.repositoryName,
    manifest.images.postgres.repositoryName,
  ];

  if (manifest.services.auth.mode === "source") {
    reposToEnsure.push(manifest.images.auth.repositoryName);
  }

  if (manifest.services.admin.mode === "source") {
    reposToEnsure.push(manifest.images.admin.repositoryName);
  }

  await ensureEcrRepositories(
    manifest.awsProfile,
    manifest.region,
    reposToEnsure,
  );

  const registry = buildEcrRegistry(accountId, manifest.region);
  const password = await getEcrLoginPassword(
    manifest.awsProfile,
    manifest.region,
  );

  await dockerLogin(registry, password);

  const webImage = buildEcrImageUri(
    registry,
    manifest.images.web.repositoryName,
    manifest.images.web.tag,
  );
  const apiImage = buildEcrImageUri(
    registry,
    manifest.images.api.repositoryName,
    manifest.images.api.tag,
  );
  const postgresImage = buildEcrImageUri(
    registry,
    manifest.images.postgres.repositoryName,
    manifest.images.postgres.tag,
  );

  await buildAndPushOne(
    path.resolve(projectDir, requireServicePath(manifest.services.web, "web")),
    webImage,
  );
  await buildAndPushOne(
    path.resolve(projectDir, requireServicePath(manifest.services.api, "api")),
    apiImage,
  );
  await buildAndPushOne(
    path.join(getAwsDevInfraDir(projectDir), "postgres"),
    postgresImage,
  );

  let authImage = "";
  if (manifest.services.auth.mode === "source") {
    authImage = buildEcrImageUri(
      registry,
      manifest.images.auth.repositoryName,
      manifest.images.auth.tag,
    );
    await buildAndPushOne(
      path.resolve(
        projectDir,
        requireServicePath(manifest.services.auth, "auth"),
      ),
      authImage,
    );
  } else {
    authImage = requireServiceImage(manifest.services.auth, "auth");
  }

  let adminImage = "";
  if (manifest.services.admin.mode === "source") {
    adminImage = buildEcrImageUri(
      registry,
      manifest.images.admin.repositoryName,
      manifest.images.admin.tag,
    );
    await buildAndPushOne(
      path.resolve(
        projectDir,
        requireServicePath(manifest.services.admin, "admin"),
      ),
      adminImage,
    );
  } else {
    adminImage = requireServiceImage(manifest.services.admin, "admin");
  }

  return {
    web_image: webImage,
    api_image: apiImage,
    auth_image: authImage,
    admin_image: adminImage,
    postgres_image: postgresImage,
  };
}
