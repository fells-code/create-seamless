export function printHelp() {
  console.log(`
create-seamless

Seamless Auth CLI — scaffold and integrate passwordless authentication.

────────────────────────────────────────────

USAGE

  npx create-seamless
  npx create-seamless <project-name>
  npx create-seamless -h
  npx create-seamless --help

────────────────────────────────────────────

BEHAVIOR

  npx create-seamless

  Without a name:
    • If directory is empty → create a new project

  npx create-seamless <project-name>
  
  With a name:
    • Creates a new directory

────────────────────────────────────────────

WHAT YOU CAN BUILD

  • A web application starter with Seamless Auth
  • An API server starter with Seamless Auth
  • SeamlessAuth server (local or Docker)

────────────────────────────────────────────

EXAMPLES

  npx create-seamless
    → Interactive setup in current directory

  npx create-seamless my-app
    → Create new project in ./my-app

────────────────────────────────────────────

DOCS

  https://docs.seamlessauth.com

`);
}
