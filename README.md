# create-seamless

[![License: AGPL-3](https://img.shields.io/badge/License-AGPL3-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/create-seamless.svg?style=flat)](https://www.npmjs.com/package/create-seamless)

`create-seamless` is a project scaffolding tool for building applications with **Seamless Auth**, an open source, passwordless authentication system.

It provisions a local, production-shaped development environment that can include:

- The Seamless Auth open source server
- A starter web application
- A starter API server

The generated project is fully local and requires no hosted services or external accounts to run.

---

## What this creates

Depending on the flags provided, `create-seamless` scaffolds a local project with the following structure:

```text
my-app/
├─ auth/        # Seamless Auth OSS server
├─ web/         # Starter web application (optional)
├─ api/         # Starter API server (optional)
└─ README.md
```

Each service is independently runnable and preconfigured to work together using local URLs and environment variables.

The intended development workflow is to run each service in its own terminal:

```bash
# terminal 1
cd auth && npm run dev

# terminal 2
cd api && npm run dev

# terminal 3
cd web && npm run dev
```

---

## Usage

Run via `npx`:

```bash
npx create-seamless my-app
```

By default, this scaffolds the full local stack:

- Seamless Auth server
- Web application
- API server

---

## CLI options

| Flag          | Description                                  |
| ------------- | -------------------------------------------- |
| `--auth`      | Include the Seamless Auth open source server |
| `--web`       | Include the starter web application          |
| `--api`       | Include the starter API server               |
| `--install`   | Automatically install dependencies           |
| `--no-git`    | Skip git initialization                      |
| `--auth-port` | Auth server port (default: 3000)             |
| `--api-port`  | API server port (default: 4000)              |
| `--web-port`  | Web dev server port (default: 5173)          |

If no component flags are provided, all components are included.

---

## Included projects

`create-seamless` pulls directly from the following open source repositories:

- Seamless Auth Server
  [https://github.com/fells-code/seamless-auth-api](https://github.com/fells-code/seamless-auth-api)

- Seamless Auth React Starter
  [https://github.com/fells-code/seamless-auth-starter-react](https://github.com/fells-code/seamless-auth-starter-react)

- Seamless Auth API Starter
  [https://github.com/fells-code/seamless-auth-starter-express](https://github.com/fells-code/seamless-auth-starter-express)

Each repository can be used independently, but `create-seamless` wires them together for local development out of the box.

---

## Documentation

Full documentation for Seamless Auth, including architecture, configuration, and deployment guidance, is available at:

[https://seamlessauth.com/docs](https://seamlessauth.com/docs)

---

## Philosophy

Seamless Auth is designed around:

- Passwordless authentication only
- Embedded auth (no redirects or callbacks)
- Self-hosted, open source foundations
- Production-shaped local development
- Minimal assumptions and explicit configuration

`create-seamless` exists to make getting started with this model straightforward and repeatable.

---

## Requirements

- Node.js 18 or newer
- npm or pnpm

---

## License

**AGPL-3.0-only** © 2026 Fells Code LLC

This license ensures:

- transparency of security-critical code
- freedom to self-host and modify
- sustainability of the managed service offering

See [`LICENSE`](./LICENSE) for details.
