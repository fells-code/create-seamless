import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, "../../");

export const TEMPLATE_ROOT = path.join(PROJECT_ROOT, "templates");

export function getInfraDir(projectDir: string): string {
  return path.join(projectDir, "infra");
}

export function getDeployManifestPath(projectDir: string): string {
  return path.join(getInfraDir(projectDir), "deploy.json");
}

export function getAwsDevInfraDir(projectDir: string): string {
  return path.join(getInfraDir(projectDir), "aws", "dev");
}
