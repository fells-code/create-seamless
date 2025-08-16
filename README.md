# create-seamless

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/create-seamless.svg?style=flat)](https://www.npmjs.com/package/create-seamless)

🚀 A simple way to bootstrap a new project with [SeamlessAuth](https://seamlessauth.com).  
This CLI helps you quickly spin up a React + Vite starter template (with HTTPS preconfigured) so you can start building secure apps right away.

## ✨ Features

- 📦 **One command setup** with `npx create-seamless <project-name>`
- 🔒 **HTTPS ready** out of the box (self-signed certs auto-generated)
- ⚡ **Vite + React starter** integrated with SeamlessAuth
- 🧹 Automatic cleanup on errors (no half-created projects)
- 🔮 Future support for:
  - API server scaffolding
  - Mode flags (`--web`, `--server`)
  - Multiple starter templates

## 🚀 Quick Start

```bash
# Create a new project
npx create-seamless my-app

cd my-app
npm install
npm run dev
```

Once the dev server starts, open https://localhost:5001.
Your browser may ask you to trust the local certificate the first time.

## 🛠 Requirements

- Node.js v20+
- npm or pnpm

## ⚙️ Options (coming soon)

We plan to add support for additional flags to customize your setup:

```bash
# React web starter (default)
npx create-seamless my-app --react

# Include a working web server for backend validations
npx create-seamless my-app --server
```

## 📂 Project Structure

After running the command, you’ll get:

```graphql
my-app/
├─ .cert/               # Self-signed certificates for local HTTPS
├─ src/                 # React source code
├─ vite.config.js       # Preconfigured with HTTPS + SeamlessAuth
├─ package.json
└─ README.md
```

## 🔒 HTTPS Certificates

The CLI automatically generates self-signed certificates in .cert/.
These are used only for local development. If your browser warns you, simply trust the certificate.

## 🧹 Cleanup on Errors

If the setup process fails at any step, create-seamless will automatically remove the partially created project folder to avoid clutter.

## 🤝 Contributing

We welcome contributions!

Report issues via [GitHub Issues](https://seamlessauth.com/create-seamless/issues)

Open PRs for bug fixes or new features
