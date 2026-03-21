import fs from "fs";
import path from "path";
import { runCommand } from "../core/exec.js";

export async function cloneRepo(repoUrl: string, dest: string) {
  const parentDir = path.dirname(dest);
  const folderName = path.basename(dest);

  fs.mkdirSync(parentDir, { recursive: true });

  await runCommand(
    "git",
    ["clone", "--depth", "1", repoUrl, folderName],
    parentDir,
  );
}

export function removeGitDir(projectRoot: string) {
  const gitDir = path.join(projectRoot, ".git");
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }
}

export function copyEnvExample(projectRoot: string) {
  const envExample = path.join(projectRoot, ".env.example");
  const env = path.join(projectRoot, ".env");

  if (fs.existsSync(envExample) && !fs.existsSync(env)) {
    fs.copyFileSync(envExample, env);
  }
}
