import { spawn } from "child_process";

export function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd,
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed`));
    });
  });
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function execCommand(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: options.quiet
        ? ["ignore", "pipe", "pipe"]
        : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (!options.quiet) process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (!options.quiet) process.stderr.write(text);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const exitCode = code ?? 0;
      if (exitCode !== 0) {
        const error = new Error(
          `Command failed: ${command} ${args.join(" ")}\n${stderr || stdout}`,
        );
        reject(error);
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode,
      });
    });
  });
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    await execCommand("which", [command], { quiet: true });
    return true;
  } catch {
    return false;
  }
}
