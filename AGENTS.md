# Seamless CLI Agent Guide

This repository is the Seamless Auth command-line tool (published as `seamless-cli`, invoked as
`seamless` or `npx create-seamless`). It does two things:

- **Scaffold** a working Seamless Auth project (`seamless init`): generates a React frontend, an
  Express adapter, the auth server, a Docker Compose file, and config.
- **Verify** the whole auth surface (`seamless verify`): a cross-package conformance harness that
  runs an api / adapter / react matrix against the ecosystem.

Use this file as the fast path. The verify harness has its own moving parts under
[verify/](verify) (a Docker Compose stack plus a Playwright harness).

## Working Standards (fells-code baseline)

These rules apply to every repository in the fells-code org. Repo-specific
guidance may extend them but must not contradict them.

### Attribution
- Commit and open PRs solely under the repository owner's identity. Never
  commit under an agent or assistant identity.
- Never attribute work to an AI assistant: no `Co-Authored-By: Claude` (or any
  assistant) trailers, no "Generated with" / "Created with Claude" notes, and no
  assistant branding or emoji anywhere in commit messages, PR or issue titles
  and descriptions, changesets, code comments, or docs.

### Comments
- Comment only when the code genuinely needs explaining: a non-obvious reason, a
  gotcha, or an invariant. Never narrate what the code plainly does.

### TODOs
- Every `TODO`/`FIXME` must reference a ticket, e.g. `// TODO(#123): ...`.
  Do not leave a bare TODO. If no ticket exists, create one first.

### Commits & branches
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `test:`).
- Descriptive branch names (`feat/...`, `fix/...`); never a `claude/` or other
  tool-generated prefix.

### Public-facing text
- No em dashes in commit messages, code comments, PR or issue text, changesets,
  or docs. Use a comma, parentheses, or a separate sentence.

### Before declaring work done
- All code quality checks must pass before you open a PR or call the work done.
  Run them and report the real output; do not open a PR while any check is failing.
- Commands: `npm run build` (runs `tsc`, which type-checks) and `npm test`
  (`vitest run`); `npm run coverage` enforces the coverage thresholds. There is no
  separate lint/format tooling configured yet. Never claim a change works without
  running these.
- Match the surrounding code's style, naming, and comment density.

## Start Here

- Install dependencies: `npm install`
- Build (type-check and emit): `npm run build` (`tsc`, output in `dist/`)
- Run from source: `npm run dev -- <command>` (`tsx`); or after building, `node dist/index.js <command>`
- Commands: `init [name]`, `check`, `bootstrap-admin [email]`, `verify [flags]`,
  and the instance-management commands `profile`, `login`, `whoami`, `logout`,
  `sessions`, `config`, `users`, `org` (all dispatched from `src/index.ts`)

The entry point is [src/index.ts](src/index.ts), which dispatches to a command module in
`src/commands/`.

## Commands

- **init** ([src/commands/init.ts](src/commands/init.ts)) scaffolds a project, driven by
  `src/prompts/`. The web and api starters come from the registry-driven template source
  ([src/core/templates.ts](src/core/templates.ts)): it reads `registry.json` from the
  `fells-code/seamless-templates` monorepo (pinned by `SEAMLESS_TEMPLATES_REF` in
  [src/core/images.ts](src/core/images.ts)), downloads the selected templates, and applies each
  template's `template.json` env contract. The auth, docker, and config pieces are still generated
  locally in `src/generators/*`. Override the template source for development with
  `SEAMLESS_TEMPLATES_DIR` (a local checkout) or `SEAMLESS_TEMPLATES_REF` (a different ref).
  - A `--<alias>` flag (e.g. `seamless init --oauth`) preselects the template whose registry
    `alias` matches, skipping the web prompt. Aliases live in the registry, so no per-flag code.
  - A template can declare `setup.oauth` in its `template.json` to trigger the OAuth provider
    prompts ([src/prompts/oauthSetup.ts](src/prompts/oauthSetup.ts), catalog in
    [src/core/oauthProviders.ts](src/core/oauthProviders.ts)). The chosen providers are wired into
    the auth server env (`OAUTH_PROVIDERS`, per-provider `*_CLIENT_SECRET`, the `oauth` login
    method) by `buildAuthEnv` in [src/generators/docker/docker.ts](src/generators/docker/docker.ts).
- **check** health-checks a running stack (local or managed).
- **bootstrap-admin** mints the first admin invite against the app API.
- **verify** ([src/commands/verify.ts](src/commands/verify.ts)) runs the conformance harness (below).
- **instance management** — `profile` (targets, plus `profile login`),
  `logout`/`whoami`, `sessions`, `config` (system config + OAuth providers),
  `users`, and `org` all talk to a running instance and are authenticated by the
  stored session.
- **portal** — `login` signs in to the Seamless portal, a separate account from
  any instance profile. Its session lives beside the profile map in
  `config.json` and is the only one `init` uses to connect a managed
  application ([src/core/authClient.ts](src/core/authClient.ts) exposes
  `createPortalClient` for it).

## The verify harness

`seamless verify` stands up the ecosystem with Docker Compose and runs a Playwright matrix, then
prints a flow x layer pass/fail grid (plus JUnit and HTML reports).

- [verify/docker-compose.verify.yml](verify/docker-compose.verify.yml): postgres, the auth API, and
  the adapter, plus the React starter behind the `react` compose profile. The mock OIDC provider runs
  in-process in `global-setup` (it is not a container).
- [verify/adapter-app](verify/adapter-app): a minimal `@seamless-auth/express` adopter backend with a
  capture transport, so the harness can read OTP / magic-link codes the adapter would otherwise strip.
- [verify/harness](verify/harness): the Playwright projects (`api`, `adapter`, `react`), `lib/`
  helpers, `mock-oidc.ts`, `global-setup.ts`, and `lib/matrixReporter.ts` (the printed grid). It has
  its own `node_modules` and browsers.

Modes and sibling repos:

- `--local` builds the `@seamless-auth/*` packages from source (pre-publish contract testing); the
  default uses the published packages.
- The sibling repos are resolved relative to this repo, overridable with `SEAMLESS_API_DIR`,
  `SEAMLESS_SERVER_DIR`, `SEAMLESS_REACT_SDK_DIR` (the React SDK), and `SEAMLESS_REACT_DIR` (the
  `react-vite` web template, defaulting to `../seamless-templates/templates/web/react-vite`).
- Useful flags: `--api-only`, `--no-react`, `--filter=<flow>` (the `=` form; a space-separated `--filter <flow>` is not parsed), `--keep-up`.

## Important Folders

- [src/commands](src/commands): one file per CLI command
- [src/generators](src/generators): locally generated scaffolding (auth, docker, config)
- [src/core](src/core): shared helpers (templates, exec, env, fetch, secrets, paths, package manager, output)
- [src/prompts](src/prompts): interactive setup prompts (`@clack/prompts`)
- [src/utils](src/utils): repo and env-file helpers
- [verify](verify): the conformance harness (shipped with the package)

Templates are not in this repo — they live in the `seamless-templates` monorepo
(`SEAMLESS_TEMPLATES_REPO`) and are fetched at scaffold time.

## Conventions

- **TypeScript, ESM** (`"type": "module"`). Local imports use `.js` extensions (NodeNext resolution).
- Commit, comment, TODO, and attribution rules live in Working Standards above.
- **Releases use Changesets.** A user-facing change needs a changeset (`npm run changeset`). A push to
  `main` opens a "version packages" PR that bumps the version and writes `CHANGELOG.md`; merging that
  PR publishes to npm. Do not hand-edit the version or `CHANGELOG.md`.
- **npm publish token.** The release workflow publishes with the `NPM_TOKEN` repo secret. It must be a
  classic **Automation** token (full publish rights, bypasses 2FA) owned by an account with publish
  access to `seamless-cli`; a granular token restricted to a package allowlist cannot create or
  publish it and the registry returns a confusing `E404` on the `PUT`.
- **Templates ref bump.** Shipping a change that depends on a new templates release is a two-step,
  cross-repo dance: release `seamless-templates` first, then bump `SEAMLESS_TEMPLATES_REF`
  ([src/core/images.ts](src/core/images.ts)) to that tag.
- **Coverage badge.** `README.md` shows a line-coverage badge (`resources/coverage-badge.svg`)
  regenerated locally by a Husky `pre-commit` hook ([.husky/pre-commit](.husky/pre-commit)): it runs
  `npm run coverage` (`src/**/*.test.ts` only, so it never sweeps the Playwright specs under
  `verify/`), then `npm run coverage:badge` ([scripts/updateCoverageBadge.mjs](scripts/updateCoverageBadge.mjs))
  to rewrite the SVG from `coverage/coverage-summary.json`, stages it, and rebuilds. We standardized on
  the pre-commit hook (matching `seamless-auth-api`) rather than a CI staleness check, so the committed
  badge always reflects the latest local run. If you change coverage, let the hook regenerate the badge;
  do not hand-edit the SVG.
## Before You Finish A Change

- Run `npm run build` (the root package's only build step).
- If you touched the harness: `cd verify/harness && npx tsc --noEmit`, then run `seamless verify`
  (`--local` to exercise local SDK source, or `--api-only` for a fast pass).
- Add a changeset for any user-facing change.

## Known Maintenance Traps

- **Sibling-repo branches**: every sibling repo (api, server, react SDK, seamless-templates) is checked out
  at its default branch (`main`) when no explicit `*-ref` is passed to the verify CI workflow.
- **`--local` needs SDK dependencies**: it builds the server (pnpm) and the React SDK (npm) from source
  on the host, so those repos must have their dependencies installed first. CI installs them explicitly.
- **OAuth mock networking**: the in-process mock OIDC is reached by the browser and harness via
  `localhost`, but by the API container via `host.docker.internal`, so the provider config splits the
  authorize URL from the token / userinfo URLs.
- **Adapter OTP limiter**: the adapter funnels all OTP through one client IP, so the API's per-IP OTP
  limiter (10 per 15 minutes, hardcoded) bounds adapter / react OTP traffic. Keep specs off it where
  possible (for example, magic-link login instead of a second email-OTP round trip).
- **Version pins**: [verify/adapter-app](verify/adapter-app) pins `@seamless-auth/express` and the
  `react-vite` template pins `@seamless-auth/react`. Bump these when new versions publish.
- **Templates ref**: the CLI scaffolds from `seamless-templates` at `SEAMLESS_TEMPLATES_REF`
  ([src/core/images.ts](src/core/images.ts)); bump it when a new templates release publishes.
