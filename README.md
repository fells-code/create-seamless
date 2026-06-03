# Seamless CLI

[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL3-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/seamless-cli.svg?style=flat)](https://www.npmjs.com/package/seamless-cli)

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

- Seamless Auth React Starter
  [https://github.com/fells-code/seamless-auth-starter-react](https://github.com/fells-code/seamless-auth-starter-react)

- Seamless Auth API Starter
  [https://github.com/fells-code/seamless-auth-starter-express](https://github.com/fells-code/seamless-auth-starter-express)

Each project can be used independently, but the CLI connects them into a working system.

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
