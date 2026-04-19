#!/usr/bin/env node

import { runCLI } from "./commands/init.js";
import { runCheck } from "./commands/check.js";
import { printHelp } from "./commands/help.js";
import pkg from "../package.json" with { type: "json" };
import { runBootstrapAdmin } from "./commands/bootstrapAdmin.js";
import { deploy } from "./commands/deploy.js";
import { destroy } from "./commands/destroy.js";

export const VERSION = pkg.version;
const args = process.argv.slice(2);

const command = args[0];

async function main() {
  if (!command) {
    printHelp();
    return;
  }

  if (command === "-h" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "-v" || command === "--version") {
    console.log(VERSION);
    return;
  }

  if (command === "deploy") {
    await deploy();
    return;
  }

  if (command === "destroy") {
    await destroy();
    return;
  }

  if (command === "init") {
    const projectName = args[1];
    await runCLI(projectName);
    return;
  }

  if (command === "check") {
    await runCheck();
    return;
  }

  if (command === "bootstrap-admin") {
    const email = args[1];
    await runBootstrapAdmin(email);
    return;
  }

  await runCLI(command);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
