#!/usr/bin/env node

import { runCLI } from "./commands/init.js";
import { runCheck } from "./commands/check.js";
import { printHelp } from "./core/help.js";
import pkg from "../package.json" with { type: "json" };

export const VERSION = pkg.version;
const args = process.argv.slice(2);

const command = args[0];

async function main() {
  if (!command) {
    await runCLI();
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

  if (command === "init") {
    const projectName = args[1];
    await runCLI(projectName);
    return;
  }

  if (command === "check") {
    await runCheck();
    return;
  }

  await runCLI(command);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
