# Seamless CLI

[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL3-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/seamless-cli.svg?style=flat)](https://www.npmjs.com/package/seamless-cli)
![coverage](resources/coverage-badge.svg)

Seamless CLI is a command-line tool for bootstrapping applications with Seamless Auth, an open source, passwordless authentication system.

It guides you through creating a fully working authentication stack with a web app, API, and auth server that are already connected and ready to run.

---

## Getting started

Run the CLI with `npx`:

```bash
npx seamless-cli init my-app
```

Or run it in your current directory:

```bash
npx seamless-cli init
```

You’ll be guided through a short setup process where you can choose:

- Whether to create a web application
- Whether to create an API server
- How to run the auth server (local or Docker)
- Whether to run everything with Docker

---

## Connecting to a managed instance

If you are logged in to a managed Seamless Auth account (see
[Authenticating against an instance](#authenticating-against-an-instance)), `init` connects the new
project to your managed instance instead of scaffolding a local auth server. This is the default
whenever a profile has an active session.

```bash
seamless login          # once, against your managed profile
seamless init my-app    # scaffolds web + api wired to the managed instance
```

What happens:

- The CLI lists your applications from the control plane and, when you have more than one, asks
  which to connect. Skip the prompt with `--app <id>` (an application id or infra id).
- It issues the application's service token from the control plane (the real credential, not a
  locally generated secret) and writes it, the managed auth server URL, and the JWKS key id into
  `api/.env`. The frontend is pointed at the same auth server URL.
- No local auth server, Docker Compose, or admin dashboard is generated. Auth, users, and OAuth
  providers are managed from the dashboard.

Because the service token is shown only once at issue time, `init` confirms before issuing a new
one for an application that already has a token (issuing a new token invalidates the old one).

Run inside an existing project (a non-empty directory) to wire it up in place: `init` updates
`api/.env` when an `api` directory is present, otherwise it prints the values to set by hand. Your
own source is never overwritten.

Escape hatches:

- `seamless init --local` forces the self-hosted flow below, even when logged in.
- With no active session, `init` uses the self-hosted flow automatically.
- `SEAMLESS_PORTAL_API_URL` overrides the control-plane host (defaults to the managed service).

---

## What gets created

Depending on your selections, the CLI generates a project like this:

```text
my-app/
├─ auth/        # Seamless Auth server (optional)
├─ web/         # React web application (optional)
├─ api/         # Express API server (optional)
├─ docker-compose.yml (optional)
└─ README.md
```

All services are preconfigured to work together.

- Web calls the API
- API communicates with the auth server
- Auth manages sessions and tokens

No manual wiring is required.

---

## Running your project

### Option 1: Docker

If you choose Docker during setup:

```bash
docker compose up
```

This starts:

- PostgreSQL
- Auth server
- API server
- Web app

All services are configured to communicate correctly inside the container network.

---

### Option 2: Local development

If you choose to run locally:

#### 1. Start PostgreSQL

Make sure you have a local PostgreSQL instance running on port `5432`.

---

#### 2. Start the auth server

```bash
cd auth
npm install

npm run db:create
npm run db:migrate

npm run dev
```

---

#### 3. Start the API

```bash
cd api
npm install
npm run dev
```

---

#### 4. Start the web app

```bash
cd web
npm install
npm run dev
```

---

## Creating the first admin

A fresh instance has no admin yet. `seamless bootstrap-admin` issues the first admin invite:

```bash
seamless bootstrap-admin admin@example.com                 # active profile's instance
seamless bootstrap-admin admin@example.com --profile prod  # a specific instance
seamless bootstrap-admin                                   # prompts for the email
```

The invited user then completes registration to receive admin access.

**Where it points.** The target instance is resolved from your active profile's `instanceUrl`
(respecting `--profile` and `SEAMLESS_PROFILE`), so you can bootstrap a remote instance you never
scaffolded locally. Set `SEAMLESS_API_URL` to override it, or — when no profile is configured — it
falls back to `http://localhost:3000` for local dev.

**How it authenticates.** Bootstrap runs _before_ any admin exists, so it can't use a login
session. Instead it uses the instance's shared bootstrap secret, resolved automatically from a
local `.env`, `auth/.env`, or `docker-compose.yml`, and prompted for if none is found (for example
when bootstrapping a production instance from a machine without the project checked out).

## Authenticating against an instance

Beyond scaffolding, the CLI can log in to a Seamless Auth instance (self-hosted, a managed
tenant, or local dev) and call its authenticated and admin endpoints from the terminal. It talks
to the instance directly over Bearer and JSON, so no server or contract changes are required.

### Profiles

The CLI targets instances through named profiles stored at `~/.config/seamless/config.json`
(respecting `XDG_CONFIG_HOME`). Profiles hold no secrets; tokens live in the OS keychain (see
below). Pick the active profile per command with `--profile <name>` or the `SEAMLESS_PROFILE`
environment variable, otherwise the `default` profile is used.

```bash
# Add a profile (prompts if you omit the flags)
seamless profile add prod --instance-url https://auth.example.com
seamless profile add local --instance-url http://localhost:5312

seamless profile list          # active profile is marked with *
seamless profile use local     # switch the active profile
seamless profile remove local  # delete a profile (also clears its keychain tokens)
```

`instanceUrl` is normalized: the trailing slash is stripped and `https` is required for any host
other than `localhost`, `127.0.0.1`, or `::1`.

### Logging in

Login uses email OTP: you paste the code from your inbox, so nothing needs to be delivered to the
CLI and no service token is required.

```bash
seamless login                       # prompts for the identifier, then the code
seamless login you@example.com       # identifier as an argument
seamless login --identifier you@example.com --profile prod
```

The command honors the instance's advertised login methods, caps local retries so it does not trip
the OTP rate limiter, and refreshes the code automatically if the five minute window lapses.

### Identity and sessions

```bash
seamless whoami                 # sub, email, roles, active profile, and instance URL
seamless logout                 # end the current session and clear local tokens
seamless logout --all           # revoke every session for the user, then clear local tokens

seamless sessions               # list active sessions (current one marked)
seamless sessions revoke <id>   # revoke one session (confirms if it is the current one)
seamless sessions revoke --all  # revoke every session (confirms, then clears local tokens)
```

### Configuration as code

Read and write the instance system configuration (requires an admin role). This turns the
dashboard's config panel into something you can version, diff, and apply in CI.

```bash
seamless config get                       # print the whole config
seamless config get access_token_ttl      # print a single key
seamless config get --json > config.json  # capture as JSON

# Values are parsed as JSON, falling back to a string, so every shape works:
seamless config set access_token_ttl 15m
seamless config set rate_limit 250
seamless config set passkey_login_fallback_enabled false
seamless config set login_methods '["email_otp","passkey"]'

seamless config roles                     # list the instance's roles

seamless config diff config.json          # show how a local file differs from the instance
seamless config apply config.json --dry-run   # preview the delta
seamless config apply config.json             # apply after a confirmation prompt
```

`apply` sends only the changed keys and ignores read-only or unknown keys, so a full config
captured with `config get --json` can be edited and applied directly. Token TTLs, origins, login
methods, and the WebAuthn RP id are all readable and writable.

### Admin: users and organizations

Manage users and organizations from the terminal (requires an admin role).

```bash
seamless users list --limit 50 --offset 0
seamless users delete <id>                 # confirms first
seamless users credentials <id>            # registered credentials for a user
seamless users prepare-device-replacement <id>   # admin-assisted recovery

seamless org list
seamless org create "Acme Inc" --slug acme
seamless org get <id>
seamless org update <id> --name "Acme" --slug acme

seamless org members list <orgId>
seamless org members add <orgId> --email person@example.com --roles member,billing
seamless org members update <orgId> <userId> --roles admin
seamless org members remove <orgId> <userId>
```

A non-admin user receives a clear permission error rather than a stack trace.

### Token storage and the keychain

The refresh token is the durable secret, so sessions are stored in the operating system keychain,
never in a plaintext file:

- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service (libsecret, for example GNOME Keyring or KWallet)

Tokens are keyed per profile (by name and instance URL) so multiple instances never collide, and
they are removed when you log out or remove the profile. Access tokens are refreshed transparently:
on a `401` the CLI rotates the pair via `/refresh`, stores the new tokens, and retries once. A
rotated or reused refresh token clears the local session and prompts a fresh login.

### Headless and CI

When no OS keychain is available (for example a headless CI runner), the CLI does not fall back to
a plaintext file. Instead, set `SEAMLESS_REFRESH_TOKEN` to a valid refresh token and the CLI will
use it to obtain an access token for the run:

```bash
export SEAMLESS_PROFILE=prod
export SEAMLESS_REFRESH_TOKEN=<refresh-token>
seamless whoami
```

Because `/refresh` rotates the refresh token on every call, this path is best for a single
invocation; the rotated token is held only in memory for that process.

---

## What is configured for you

Seamless CLI handles the parts that are usually difficult to get right:

- Shared API service tokens
- JWT signing configuration
- JWKS key generation for production mode
- Cross-service environment variables
- CORS and cookie-based session handling

Everything is aligned across services so the system works immediately after setup.

---

## Included projects

Seamless CLI pulls from the following repositories:

- Seamless Auth API
  [https://github.com/fells-code/seamless-auth-api](https://github.com/fells-code/seamless-auth-api)

- Seamless Templates (the frontend and API starters)
  [https://github.com/fells-code/seamless-templates](https://github.com/fells-code/seamless-templates)

The starters live in the templates monorepo and are listed in its registry, so the set of
frameworks the CLI offers grows there. Each project can be used independently, but the CLI connects
them into a working system.

---

## Documentation

Full documentation is available at:

[https://docs.seamlessauth.com](https://docs.seamlessauth.com)

---

## Philosophy

Seamless Auth is built around a few principles:

- Passwordless authentication only
- No redirects or third-party auth providers
- Self-hosted by default
- Production-shaped local development
- Explicit configuration over hidden behavior

Seamless CLI exists to make this setup fast and repeatable.

---

## Requirements

- Node.js 18 or newer
- npm or pnpm
- Docker (optional)

---

## Testing local CLI changes

From the repository root, build the CLI and link the local package:

```bash
npm install
npm run build
npm link
```

Then run the linked command:

```bash
seamless --version
seamless --help
```

When you are done testing, remove the global link:

```bash
npm unlink -g seamless-cli
```

To smoke test the package artifact before publishing:

```bash
npm run build
TARBALL=$(npm pack --pack-destination /tmp)
TEST_DIR=$(mktemp -d)

cd "$TEST_DIR"
npm install "/tmp/$TARBALL"
npm exec -- seamless --version
npm exec -- seamless --help
```

If npm cache permissions block local testing, use a writable temporary cache:

```bash
npm --cache /tmp/npm-cache exec -- seamless --version
```

---

## License

AGPL-3.0-only © 2026 Fells Code LLC

This license ensures:

- transparency of security-critical code
- freedom to self-host and modify
- sustainability of the managed service offering

See `LICENSE` for details.
