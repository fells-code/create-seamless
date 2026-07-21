# seamless-cli

## 0.8.0

### Minor Changes

- 8468863: Target `bootstrap-admin` at the active profile's instance URL instead of requiring a local `seamless.config.json`. The command now resolves the instance from the active profile (respecting `--profile` and `SEAMLESS_PROFILE`), with `SEAMLESS_API_URL` as an override and `http://localhost:3000` as the fallback when no profile is configured. The bootstrap-secret auth flow is unchanged.

### Patch Changes

- 5126998: Document `bootstrap-admin` in the README: add a "Creating the first admin"
  section covering the command, its profile-based instance targeting (with the
  `SEAMLESS_API_URL` override and `http://localhost:3000` fallback), and the
  bootstrap-secret authentication it uses because it runs before any admin exists.

## 0.7.0

### Minor Changes

- 6af3216: feat(init): connect scaffolds to a managed instance when a profile is logged in

  `seamless init` now defaults to the managed control plane whenever a profile has an active session. It reads the logged-in session, lists your applications, issues the application's service token from the control plane (rather than generating a local secret), and points the scaffolded web and api at the managed auth instance. Running `init` inside an existing project wires the managed credentials into `api/.env` in place, or prints them when there is no api directory. The self-hosted flow stays available with `seamless init --local`, and is still used automatically when no session is present. Set `SEAMLESS_PORTAL_API_URL` to override the control-plane host.

### Patch Changes

- f8c4478: chore(templates): scaffold from seamless-templates v0.2.4

  Bump `SEAMLESS_TEMPLATES_REF` to `v0.2.4`. The Express template now has a working production `npm run start` (fixed extensionless ESM imports and the migration runner path) and ships the `docker-compose.yml` its scripts and README referenced. The web templates (react-vite and react-oauth) drop the unused `VITE_AUTH_SERVER_URL`, and all templates document both the local and managed init paths.

## 0.6.0

### Minor Changes

- d09317c: Add admin verbs for users and organizations (requires an admin role).
  `seamless users` covers `list` (with client-side `--limit`/`--offset` paging and
  `--json`), `delete <id>` (with confirmation), `credentials <id>` (from the admin
  user detail endpoint), and `prepare-device-replacement <id>` for admin-assisted
  recovery. `seamless org` covers `list`, `create`, `get`, and `update`, and
  `seamless org members` covers `list`, `add` (by `--user` id or `--email`, with
  `--roles`/`--scopes`), `update`, and `remove` (with confirmation). Every command
  surfaces a 403 as a clear permission error, and device replacement explains the
  step-up requirement when the CLI session is not elevated. Accepts `--profile`
  and honors `SEAMLESS_PROFILE`.
- 29cef7d: Add a multi-profile config store and `seamless profile` commands so the CLI can
  target multiple Seamless Auth instances (self-hosted, managed tenant, local dev)
  under named profiles. Profiles live in `~/.config/seamless/config.json`
  (respecting `XDG_CONFIG_HOME`) and hold no secrets. New subcommands: `profile
list`, `profile add`, `profile use`, and `profile remove`. The active profile can
  be selected per command with `--profile <name>` or the `SEAMLESS_PROFILE`
  environment variable, defaulting to the `default` profile.
- 4d9cc23: Add an authenticated HTTP client that targets the active profile's instance,
  attaches the Bearer access token, and transparently refreshes on expiry. On a
  401 it calls `POST /refresh` with the opaque refresh token, persists the rotated
  pair, and retries the original request once. A rotated or reused refresh token
  clears the local session and raises a clear re-login prompt instead of a stack
  trace. Non-JSON and empty response bodies are parsed defensively, and rate-limit
  (429) responses are surfaced without triggering a refresh.
- f24a71d: Add `seamless config`, config-as-code for an instance's system configuration
  (requires an admin role). `config get [key] [--json]` reads the config from `GET
/system-config/admin`, `config set <key> <value>` writes one key via `PATCH
/system-config/admin` (the value is parsed as JSON, falling back to a string, so
  TTLs, arrays, booleans, and numbers all work), and `config roles` lists the
  instance's roles. `config diff <file>` shows how a local JSON config file
  differs from the instance, and `config apply <file>` applies the delta after a
  confirmation prompt, with `--dry-run` to preview. Read-only or unknown keys in a
  file are ignored on apply, and a non-admin user gets a clear permission error.
  Accepts `--profile` and honors `SEAMLESS_PROFILE`.
- 69fb8c8: Store session tokens in the OS keychain (macOS Keychain, Windows Credential
  Manager, Linux Secret Service) via `@napi-rs/keyring` instead of on disk. Tokens
  are scoped per profile (keyed by profile name and instance URL) so multiple
  instances never collide, and the refresh token, the durable secret, never
  touches config or logs. `seamless profile remove` now clears the profile's
  keychain entry. When no keychain is available (for example headless CI), the CLI
  reads a refresh token from `SEAMLESS_REFRESH_TOKEN` if set and otherwise fails
  with a clear, documented error rather than writing secrets to disk.
- 4301da5: Add `seamless login`, an interactive email OTP login for the active profile's
  Seamless Auth instance. It calls `POST /login` (honoring the instance's returned
  `loginMethods`), triggers the code with `GET /otp/generate-login-email-otp`,
  prompts for the code you paste from your inbox, and verifies it with `POST
/otp/verify-login-email-otp`. On success it stores the session in the OS keychain
  and records the identity (sub, email, identifier type) on the profile. The
  command caps local code retries so it does not trip the per-IP OTP limiter,
  surfaces a 429 clearly, refreshes the code automatically if the 5 minute
  ephemeral window lapses, and reports unreachable instances without a stack trace.
  Accepts the identifier positionally or with `--identifier`, and targets a
  specific profile with `--profile`.
- 79d076e: Add `seamless sessions` to list and revoke the logged-in user's active sessions.
  `seamless sessions` (or `sessions list`) calls `GET /sessions` and renders each
  session's id, device or user agent, IP, and last-used time, marking the current
  session. `seamless sessions revoke <id>` calls `DELETE /sessions/:id`, and
  `seamless sessions revoke --all` calls `DELETE /sessions`. Revoking the current
  session, or all sessions, prompts for confirmation first and then clears the
  local keychain tokens, since that request signs you out. Accepts `--profile` and
  honors `SEAMLESS_PROFILE`.
- a9c1ef3: Add `seamless whoami` and `seamless logout`. `whoami` calls `GET /users/me`
  through the authenticated client and prints the identity (sub, email, roles)
  alongside the active profile and instance URL, failing cleanly with a "not
  logged in" message when there is no session. `logout` ends the current session
  with `DELETE /logout` and then clears the profile's keychain tokens; `logout
--all` revokes every session for the user with `DELETE /logout/all` first. Both
  commands accept `--profile` (and honor `SEAMLESS_PROFILE`) and always clear the
  local tokens even if the server session was already gone.

### Patch Changes

- f8e8cdb: Document the CLI authentication commands in the README (profiles, login, whoami,
  sessions, logout, config, and the users and organizations admin verbs), including
  per-platform keychain behavior and the headless `SEAMLESS_REFRESH_TOKEN`
  fallback. Add a gated end-to-end test that drives the real login flow, an
  authenticated call, transparent refresh, and refresh-reuse rejection against a
  running instance (enabled with `SEAMLESS_E2E_URL`), plus an opt-in rate-limit
  check.
- f978890: `seamless verify` now prints a consolidated summary report at the end of the run:
  the seamless package versions under test (source versions for `--local`, the
  declared pins for released runs), one line per conformance layer (API / adapter and
  each web template) with its pass/fail status and duration, and an overall verdict.
  It is printed after teardown so it stays on screen without scrolling back through
  the phase output.

## 0.5.2

### Patch Changes

- 9992373: Bump the pinned `seamless-templates` ref to `v0.2.3`, so `seamless init` scaffolds the templates that ship `@seamless-auth/react` `^0.4.0` (TOTP support) and `@seamless-auth/express` `^0.7.0`.

## 0.5.1

### Patch Changes

- 9a9953a: Fix local auth mode regenerating the auth server's `.env` a second time with fresh secrets, which left the scaffolded API's `API_SERVICE_TOKEN` mismatched with the auth server's when services run outside Docker. The compose builder now reads the already-written auth env instead of rewriting it.

## 0.5.0

### Minor Changes

- 9bfaa5f: When the OAuth template is selected, `seamless init` now prompts for OIDC providers (Google, GitHub, Microsoft, GitLab) and their client id/secret, then wires them into the scaffolded auth server: OAUTH_PROVIDERS config, a per-provider `*_CLIENT_SECRET` env var, the `oauth` login method, and the `http://localhost:5173/oauth/callback` redirect URI. Providers left without credentials are scaffolded disabled with a printed next-steps note. Apple is documented as manual (its client secret is a signed JWT and it has no userinfo endpoint). The scaffold now also generates `REFRESH_TOKEN_LOOKUP_SECRET`, `TOTP_SECRET_ENCRYPTION_KEY`, and `OAUTH_STATE_SECRET` (previously left empty, falling back to the service token), and adds a healthcheck to the generated web container.

## 0.4.0

### Minor Changes

- 7409238: `seamless init --<example>` selects a use-case starter by its registry alias (e.g. `seamless init --oauth`), skipping the web prompt. Aliases are defined in the templates registry, so adding an example needs no CLI change. Unknown flags list the available examples, and the interactive web prompt now presents the available examples.
- fcac569: Scaffold web and api starters from the seamless-templates registry instead of hardcoded per-framework generators. The CLI now reads the registry to build its prompts, downloads the selected templates from the templates monorepo at a pinned ref, and applies each template's env contract. Adding a new framework is a templates-repo change, not a CLI change. Set SEAMLESS_TEMPLATES_DIR to scaffold from a local checkout, or SEAMLESS_TEMPLATES_REF to pin a different ref.
- 27a6ec1: `seamless verify` now conformance-tests every web template in the registry. It runs the API and adapter layers once, then builds, serves, and drives each web template in turn, scoping the browser suite to the flows the template's manifest declares (`verify.flows`, e.g. `["oauth"]`). React specs are tagged by feature (`@login`, `@oauth`) so a template runs only its relevant flows; a template with no declared flows runs the full suite. `SEAMLESS_REACT_DIR` still overrides with a single template.

### Patch Changes

- fbcc17e: Bump the verify adapter to `@seamless-auth/express@^0.6.0` (the stable release that includes the
  registration-session and non-JSON-response fixes), so the released conformance run tests against
  the current published packages.
- 57c7819: Point the conformance harness at the seamless-templates monorepo. `seamless verify` now resolves the React web template from `../seamless-templates/templates/web/react-vite` by default (still overridable with `SEAMLESS_REACT_DIR`), and the reusable `verify-conformance.yml` workflow checks out `seamless-templates` (input `templates-ref`) instead of the standalone starter repo.
- c41e68b: `seamless verify` now resolves the web template to conformance-test from the seamless-templates registry (the first runnable web template) instead of a hardcoded path. SEAMLESS_REACT_DIR still overrides with a direct template path, and SEAMLESS_TEMPLATES_DIR points at a local templates checkout. Running the browser suite against every web template is a follow-up.

## 0.3.0

### Minor Changes

- 993d386: Add `seamless verify`, a one-command cross-package auth conformance harness. It stands up the
  auth API, the Express adapter, and the React starter, then runs a matrix of flows (register,
  email and phone OTP, magic-link, passkey register and login, OAuth, TOTP, step-up, refresh,
  sessions, logout, organizations, admin bootstrap, and JWKS) across the api, adapter, and
  browser layers, and prints a pass/fail grid alongside JUnit and HTML reports.

  Supports `--local` (build the `@seamless-auth/*` packages from source for pre-publish contract
  testing) and a released mode against the published packages, plus filters like `--api-only`,
  `--no-react`, `--filter`, and `--keep-up`. Ships a reusable GitHub workflow so a change in any
  ecosystem repo runs the matrix against the others.
