# create-seamless

[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL3-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/create-seamless.svg?style=flat)](https://www.npmjs.com/package/create-seamless)

`create-seamless` is a CLI for bootstrapping applications with Seamless Auth, an open source, passwordless authentication system.

It guides you through creating a fully working authentication stack with a web app, API, and auth server that are already connected and ready to run.

---

## Getting started

Run the CLI with `npx`:

```bash
npx create-seamless my-app
```

Or run it in your current directory:

```bash
npx create-seamless
```

You’ll be guided through a short setup process where you can choose:

- Whether to create a web application
- Whether to create an API server
- Whether auth should use the official image or cloned source
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

If you choose source mode:

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

create-seamless handles the parts that are usually difficult to get right:

- Shared API service tokens
- JWT signing configuration
- JWKS key generation for production mode
- Cross-service environment variables
- CORS and cookie-based session handling

Everything is aligned across services so the system works immediately after setup.

---

## Included projects

create-seamless pulls from the following repositories:

- Seamless Auth API
  [https://github.com/fells-code/seamless-auth-api](https://github.com/fells-code/seamless-auth-api)

- Seamless Auth React Starter
  [https://github.com/fells-code/seamless-auth-starter-react](https://github.com/fells-code/seamless-auth-starter-react)

- Seamless Auth API Starter
  [https://github.com/fells-code/seamless-auth-starter-express](https://github.com/fells-code/seamless-auth-starter-express)

- Seamless Auth Admin Dashboard
  [https://github.com/fells-code/seamless-auth-admin-dashboard](https://github.com/fells-code/seamless-auth-admin-dashboard)

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

create-seamless exists to make this setup fast and repeatable.

---

## Requirements

- Node.js 18 or newer
- npm or pnpm
- Docker (optional)

---

## License

AGPL-3.0-only © 2026 Fells Code LLC

This license ensures:

- transparency of security-critical code
- freedom to self-host and modify
- sustainability of the managed service offering

See `LICENSE` for details.
