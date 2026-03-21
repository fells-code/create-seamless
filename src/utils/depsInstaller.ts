import { runCommand } from "../core/exec.js";

export async function installDeps(pm: string, deps: string[], root: string) {
  if (pm === "npm") {
    await runCommand("npm", ["install", ...deps], root);
  } else if (pm === "pnpm") {
    await runCommand("pnpm", ["add", ...deps], root);
  } else {
    await runCommand("yarn", ["add", ...deps], root);
  }
}

export async function installDevDeps(pm: string, deps: string[], root: string) {
  if (pm === "npm") {
    await runCommand("npm", ["install", "-D", ...deps], root);
  } else if (pm === "pnpm") {
    await runCommand("pnpm", ["add", "-D", ...deps], root);
  } else {
    await runCommand("yarn", ["add", "-D", ...deps], root);
  }
}
