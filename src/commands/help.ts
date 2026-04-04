import { VERSION } from "../index.js";

export function printHelp() {
  console.log(`
create-seamless v${VERSION}

Seamless Auth CLI — scaffold and manage full-stack authentication systems.

────────────────────────────────────────────

USAGE

  seamless init [project-name]
  seamless check
  seamless bootstrap-admin [email]
  seamless --help
  seamless --version

────────────────────────────────────────────

COMMANDS

  init [project-name]
    Scaffold a new Seamless Auth project

    Without a name:
      • Creates project in current directory

    With a name:
      • Creates new directory

  check
    Validate project setup, Docker, and running services

  bootstrap-admin [email]
    Create a bootstrap admin invite

    Automatically resolves bootstrap secret from:
      • .env
      • auth/.env
      • docker-compose.yml

    If not found, you will be prompted.

    Examples:
      seamless bootstrap-admin
      seamless bootstrap-admin admin@example.com

────────────────────────────────────────────

BEHAVIOR

  seamless <project-name>

    • Shortcut for: seamless init <project-name>

────────────────────────────────────────────

GETTING STARTED

  1. seamless init
  2. docker-compose up
  3. seamless bootstrap-admin

    → Complete registration to become admin

────────────────────────────────────────────

WHAT YOU GET

  • Web application (React starter)
  • API server (Express)
  • SeamlessAuth server (Docker or local)
  • Admin dashboard (Docker or source)
  • Docker Compose setup

────────────────────────────────────────────

EXAMPLES

  seamless init
    → Interactive setup in current directory

  seamless init my-app
    → Create new project in ./my-app

  seamless my-app
    → Shortcut for init

  seamless check
    → Validate your project

  seamless bootstrap-admin
    → Create your first admin user

────────────────────────────────────────────

DOCS

  https://docs.seamlessauth.com

`);
}
