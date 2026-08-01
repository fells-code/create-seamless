import { beforeEach } from "vitest";

// Prompts refuse to run without a TTY on stdin (see core/tty.ts), and vitest has
// none, so every test that exercises a prompt would otherwise fail on the guard
// rather than on what it is testing. Tests that want the no-terminal behavior
// set isTTY back to false in their own beforeEach, which runs after this one.
beforeEach(() => {
  process.stdin.isTTY = true;
});
