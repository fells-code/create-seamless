import path from "node:path";
import { execCommand } from "./exec.js";
import { getAwsDevInfraDir } from "./paths.js";

export async function terraformInit(projectDir: string): Promise<void> {
  await execCommand("terraform", ["init"], {
    cwd: getAwsDevInfraDir(projectDir),
  });
}

export async function terraformPlan(projectDir: string): Promise<void> {
  await execCommand("terraform", ["plan", "-out=tfplan"], {
    cwd: getAwsDevInfraDir(projectDir),
  });
}

export async function terraformApply(projectDir: string): Promise<void> {
  await execCommand("terraform", ["apply", "-auto-approve"], {
    cwd: getAwsDevInfraDir(projectDir),
  });
}

export async function terraformOutput(
  projectDir: string,
  name: string,
): Promise<string> {
  const result = await execCommand("terraform", ["output", "-raw", name], {
    cwd: getAwsDevInfraDir(projectDir),
    quiet: true,
  });

  return result.stdout.trim();
}

export function getTerraformWorkingDir(projectDir: string): string {
  return path.resolve(getAwsDevInfraDir(projectDir));
}

export async function terraformDestroy(projectDir: string): Promise<void> {
  await execCommand("terraform", ["destroy", "-auto-approve"], {
    cwd: getAwsDevInfraDir(projectDir),
  });
}
