import { VERSION } from "../index.js";

export function printHelp() {
  console.log(`
seamless v${VERSION}

Seamless CLI — scaffold and manage full-stack authentication systems.

────────────────────────────────────────────

USAGE

  seamless init [project-name] [--<example>]
  seamless check
  seamless bootstrap-admin [email]
  seamless verify [--api-only] [--filter=<flow>] [--keep-up]
  seamless profile <list|add|use|remove>
  seamless login [identifier] [--identifier <email>] [--profile <name>]
  seamless whoami [--profile <name>]
  seamless logout [--all] [--profile <name>]
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

    With an example flag (e.g. --oauth):
      • Scaffolds that use-case starter and skips the web prompt
      • --oauth also prompts for OIDC providers (Google, GitHub, Microsoft,
        GitLab) and wires the ones you configure into the auth server
      • Run an unknown flag to see the available examples

  profile <list|add|use|remove>
    Manage the Seamless Auth instances the CLI targets, stored as named
    profiles in ~/.config/seamless/config.json (respects XDG_CONFIG_HOME).

    profile list
      • Show configured profiles; the active one is marked with *

    profile add <name> --instance-url <url> [--identifier-type email|phone]
      • Create or update a profile (prompts interactively if flags are omitted)

    profile use <name>
      • Switch the active profile for subsequent commands

    profile remove <name>
      • Delete a profile

    The active profile can also be chosen per command with --profile <name> or
    the SEAMLESS_PROFILE environment variable.

  login [identifier]
    Log in to the active profile's Seamless Auth instance using email OTP.
    Prompts for the identifier (or pass it positionally or with --identifier)
    and the code sent to your inbox, then stores the session in the OS keychain.

    --profile <name>
      • Log in against a specific profile instead of the active one
      • Also selectable with the SEAMLESS_PROFILE environment variable

  whoami
    Show the identity behind the active profile's session (sub, email, roles),
    alongside the profile name and instance URL. Fails cleanly if not logged in.

  logout [--all]
    End the current session on the instance and clear the local keychain tokens.
    --all revokes every session for the user before clearing local tokens.

  check
    Validate project setup, Docker, and running services

  verify [--local] [--api-only] [--filter=<flow>] [--keep-up]
    Stand up the auth stack and run the conformance suite across the API and
    the cookie (adapter) paths. Requires Docker. Builds the auth server from
    a sibling seamless-auth-api checkout (override with SEAMLESS_API_DIR).

    --local builds and links the local @seamless-auth/* SDK source (sibling
    seamless-auth-server, override with SEAMLESS_SERVER_DIR) instead of the
    published npm packages — so you can catch SDK regressions before publishing.

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

  • Web application (React starter, or a use-case example like --oauth)
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

  seamless init --oauth my-app
    → Create ./my-app from the OAuth example starter

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
