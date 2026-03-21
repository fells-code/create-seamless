#!/usr/bin/env node

import { runCLI } from "./commands/init.js";
import { printHelp } from "./core/help.js";

const args = process.argv.slice(2);

const firstArg = args[0];

async function main() {
  if (firstArg === "-h" || firstArg === "--help") {
    printHelp();
    return;
  }

  await runCLI(firstArg);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
