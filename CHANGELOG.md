# seamless-cli

## 0.11.0

### Minor Changes

- 3ef3b68: Add `seamless apps`, so a portal account can see what it owns without opening the dashboard.
  `apps list` prints name, plan, status, and instance URL; `apps get <id>` adds the console URL,
  region, owners, trial expiry, and whether a service token has been issued (masked, never the live
  value). Both take `--json` and both require a portal session.

  Applications are now read through the portal's `instanceUrl`, which is derived from the service
  plan, rather than the stored `domain` column that goes stale when a trial is upgraded. Applications
  that have not finished provisioning are listed instead of being silently dropped. `init` is
  unchanged: it still reads `domain` and still considers only applications that have one.

  `apps list` shows the infra id as the reference (falling back to the id before provisioning), and `apps get` accepts an id, a name, or an infra id.

- 9d089c7: Move the scaffold onto the current Seamless ecosystem: auth API `v0.7.1`, admin dashboard `v0.4.0`,
  and seamless-templates `v0.8.1` (which carries `@seamless-auth/react` `^0.8.0` in both React
  starters, `@seamless-auth/express` `^0.12.0` in the Express starter, and `@seamless-auth/fastify`
  `^0.3.1` in the Fastify starter).

  A scaffolded project can now finish registration without a passkey. Registration used to end on a
  screen with a single control, leaving anyone who did not want a passkey, or whose device could not
  make one, with no way forward. The starters offer a skip when the instance has another login method
  enabled, and say so plainly when it does not. That reads from `GET /system-config/public`, a new
  unauthenticated route on the auth server that returns the configured login methods, so the sign-in
  screens can offer what an instance actually has enabled instead of a hardcoded guess. The API, the
  adapters, and the web templates all had to move together for it to work, which is why this bumps
  them as a set.

  Registration against a scaffolded Fastify API used to fail with a 500 and
  `TypeError: option maxAge is invalid: 300`. The auth server sent the registration response's `ttl`
  as the string `"300"`, and the Fastify adapter handed it to a cookie library that requires an
  integer. The Express starter never showed this, because its adapter multiplies the value into
  milliseconds and so coerced the string on the way past. It is fixed from both ends:
  `@seamless-auth/core` `0.12.1` parses the lifetime before it reaches an adapter and rejects anything
  that is not a positive whole number of seconds, and auth API `v0.7.1` sends the value as a number.

  `seamless init` now offers Fastify as a backend, listed as "Fastify (beta)" beside Express. It
  serves the same surface as the Express starter on the same environment contract, including the
  admin console at `/console` behind `SERVE_ADMIN_CONSOLE`. Two boot-time fixes land with it: an empty
  `PORT=` in `.env` now falls back to 3000 rather than binding a random free port, and `pino-pretty`
  moves to a runtime dependency so an install without dev dependencies boots. Both Express and Fastify
  starters ship `.env.example` secret placeholders long enough to clear the adapter's 32 character
  minimum, so the documented `cp .env.example .env && npm run dev` path boots. A project from
  `seamless init` was already unaffected, because the CLI fills `COOKIE_SIGNING_KEY` itself.

  Both React starters gain a protected `/session` route that shows the issued claims, roles,
  organization context, step-up freshness, and registered passkeys, so the first authenticated screen
  reads as an app rather than a `JSON.stringify` dump. Missing configuration now stops a scaffolded
  project with a message naming the variable instead of surfacing later as a 500, and the Express
  starter reports every configuration problem at once.

  The auth API drops the admin bootstrap invite flow in favor of the `OWNER_EMAIL` grant the CLI
  already writes, so the generated `.env` no longer carries `SEAMLESS_BOOTSTRAP_ENABLED`,
  `SEAMLESS_BOOTSTRAP_SECRET`, or `SEAMLESS_AUTH_DEBUG_SECRETS`. `AVAILABLE_ROLES` now offers
  `admin:read` and `admin:write` alongside bare `admin`, and assigning a role the instance does not
  list is rejected rather than silently doing nothing. Postgres TLS is configurable through `DB_SSL`,
  `DB_SSL_CA`, and `DB_SSL_REJECT_UNAUTHORIZED`, and `DB_URI` is accepted as a `DATABASE_URL` alias.

  The conformance harness adapter moves to `@seamless-auth/express` `^0.12.0`, which is also what
  proxies the new public system-config route. The breaking change in `0.11.0` splits `error` into
  `errorCode` and `errorBody` on the handler result types, which only affects code importing handlers
  from `@seamless-auth/core` directly; the adapter uses `createSeamlessAuthServer`, so it needed no
  source change.

- 4917717: Make `seamless init` template flags discoverable, predictable, and safe to get wrong.

  Add `seamless templates list [--json]`, which prints every starter `init` can scaffold with its id,
  kind, framework, selecting flags, and status. It reads the same registry `init` does (so
  `SEAMLESS_TEMPLATES_DIR` and `SEAMLESS_TEMPLATES_REF` apply) and needs no login, so the available
  templates no longer have to be looked up in the source.

  Every template now answers to `--<id>` as well as its shorter `--<alias>`, so `seamless init
--react-vite` works alongside `--basic`, and the api starters (`--express`, `--fastify`) have a flag
  for the first time. The "unknown option" error lists both spellings and points at
  `seamless templates list`.

  Template flags are also resolved before `init` creates a directory or asks whether to write into one
  that is not empty. An unrecognized or conflicting flag now fails immediately instead of surfacing
  only after the overwrite confirmation.

- 6e107cb: `init` now offers the managed path instead of assuming it. A portal session used to make managed the
  default silently, with `--local` as the only escape and no way to learn you needed it until after the
  template prompts. When your account has a provisioned application, `init` asks whether to connect it
  or scaffold a local stack, with managed leading.

  Whether managed is even possible is resolved before the first prompt. An account with nothing to
  connect no longer answers two prompts and then fails: it says why and continues to a local scaffold.
  That message now distinguishes "no applications yet" from "still provisioning", which the old
  `NoApplicationsError` got wrong for anyone mid-provision.

  A directory that already has files is no longer forced down the integrate path. `init` asks whether
  to connect it to a managed application or scaffold in place. Scaffolding into a non-empty directory
  was previously impossible, so a stray `README` or `.git` was enough to block a local project, and
  every route that now reaches it confirms first: starter files overwrite anything with the same name,
  and the confirmation defaults to no.

  An unreachable control plane asks before scaffolding a local stack rather than degrading silently.

  `--local` and `--app <id>` skip the new prompts, and `--app` without a session still fails rather
  than falling back.

- 490391d: Add a non-interactive `seamless init`. `--yes` (`-y`) answers every question with the option the
  prompt marks as recommended, so a scaffold runs from CI, a Dockerfile, or a script with no terminal
  attached:

  ```bash
  seamless init my-app --local --yes --email=you@example.com
  ```

  Each question also gets its own flag, honored with or without `--yes`: `--web=<id|alias>` and
  `--api=<id|alias>` choose the starters, `--email=<address>` sets the owner who becomes the admin,
  `--auth=<docker|local>` picks how the auth server runs, and `--admin=<api|image|source|none>` picks
  where the admin console is hosted. Unspecified values fall back to the recommended option, except
  the owner email, which has no safe default and is taken from `--email` or the portal session.

  `--yes` deliberately stops rather than guessing in three places. Choosing between a managed
  application and a local stack needs `--app <id>` or `--local`. Scaffolding into a directory that is
  not empty needs `--force`, since starter files overwrite anything with the same name. Rotating a
  managed application's existing service token needs `--force` too, because it breaks whatever is
  already deployed on the old one.

- cc13a6b: Connecting a project to a managed application now wires up its bundled database. `init` reads the
  application's database and writes `DATABASE_URL` into `api/.env` as
  `postgres://USER:PASSWORD@host:port/db?sslmode=require`.

  The user and password stay as literal placeholders. The control plane only returns them for
  `?reveal=true`, which this CLI never asks for, so a live database credential never reaches the
  developer's disk or terminal: they copy those from the dashboard. Anything printed as a connection
  string has its userinfo masked regardless.

  An application whose database is still provisioning produces a warning rather than a failure, and the
  database is read before the service token is rotated so a missing one is never reported against a
  project whose old token has already been invalidated. Running `init` inside an existing project adds
  `DATABASE_URL` only when there is not one already, so a working connection string is never replaced
  by a placeholder.

  This needs the templates release that teaches the express starter to read `DATABASE_URL` and
  negotiate TLS. Until `SEAMLESS_TEMPLATES_REF` is bumped to it, the value is computed but the pinned
  starter does not declare the placeholder, so nothing is written.

- 15b487a: `init` now asks for your email and writes it to the scaffolded auth server as `OWNER_EMAIL`. The auth
  server grants the admin role at account creation to a signup matching that address, so the local flow
  is `init`, `docker compose up`, register. When you are signed in to the portal, the prompt defaults to
  that account's email.

  `seamless bootstrap-admin` is removed. It existed to mint the first admin invite, which the owner
  grant now covers, and the scaffolded stack no longer enables the bootstrap route or carries a
  bootstrap secret. `seamless verify` keeps its own bootstrap secret for the conformance stack and is
  unaffected.

  The grant applies at signup only, so changing `OWNER_EMAIL` after an account exists promotes nobody.
  The success output and the README both say so.

- 4ecf296: Add per-command help. Every command now answers `-h` / `--help` with usage, flags, subcommands, and
  examples scoped to that command (`seamless init -h`, `seamless verify --help`), and
  `seamless help <command>` prints the same thing. The help text lives in one registry
  (`src/commands/helpTopics.ts`) that both the full `seamless --help` output and the per-command
  output render from, so a flag is documented once and appears in both.

  The help check runs before a command parses its own arguments, so `seamless init -h` prints help
  instead of treating `-h` as a project name. A `--` separator ends the check, so a command can still
  take a literal `-h` value (`seamless config set key -- -h`).

- 6deafb1: `seamless login` now signs in to the Seamless portal instead of the active profile's instance, and
  no longer needs a profile to exist first. The portal session is stored beside the profile map in
  `config.json` and is the only session `init` uses to connect a managed application, so a session
  for a local or self-hosted instance no longer sends its token to the control plane.

  Instance login moves to `seamless profile login [name]`, which signs in without changing the active
  profile. `seamless login --profile <name>` keeps working for one more minor version and prints a
  pointer to the new command. `whoami` and `logout` default to the portal session and take
  `--profile <name>` to target an instance.

  Set `SEAMLESS_PORTAL_AUTH_URL` to point the portal login at a different auth host.

- 51d9a9e: No command renders a prompt when stdin is not a terminal. `seamless init` got this in 0.11.0; it now
  covers every command that prompts (`login`, `profile add`, `users delete`,
  `users prepare-device-replacement`, `sessions revoke`, `org members remove`, `config apply`, and
  `config oauth-providers remove`). Each one stops naming the flag that answers the question, so a CI
  step or a scripted run fails immediately instead of hanging until its job times out.

  The confirmations that guard a destructive action now take `--force`, matching what `init` already
  means by it:

  ```bash
  seamless users delete <id> --force
  seamless sessions revoke --all --force
  seamless org members remove <orgId> <userId> --force
  seamless config apply config.json --force
  ```

  `--yes` and `-y` are accepted aliases everywhere, so `seamless config oauth-providers remove --yes`
  keeps working. `--force` does not override `--dry-run`: `config apply --dry-run --force` still
  changes nothing, and cancelling a confirmation still reads as declining rather than as an error.

- f08c21a: Scaffolding now requires `init`. An unrecognized command reports itself and exits instead of being
  treated as a project name, so `seamless verfy` no longer silently creates a directory called
  `verfy` and drops into the interactive scaffold. The error names `seamless init <name>` for anyone
  who was using the old shortcut.

  Ctrl-C is handled everywhere. Clack answers an interrupted prompt with a symbol, which several
  prompts cast straight to a string; that surfaced as a `TypeError` mid-scaffold, or as "Selected
  template Symbol(...) is not in the registry". Every prompt in init, the OAuth setup, the managed
  application picker, and `bootstrap-admin` now cancels cleanly and exits 130.

  `init` no longer leaves a project directory behind. Any failure or cancellation after the directory
  is created removes it, including a Ctrl-C during a download or a git clone, so a retry is not
  blocked by "Directory already exists". Only a directory the command itself created is ever removed,
  never an existing one and never the working directory.

  Declining the service token rotation prompt, or cancelling the application picker, now cancels the
  whole command rather than returning quietly part-way through.

### Patch Changes

- bf857b1: Update the seamless auth api image to v0.5.0.
- e2f53b3: `seamless init` no longer hangs when it has no terminal to prompt on. Run on a pipe, it used to
  render a prompt nobody could answer and wait forever, so a CI step failed only when its job timed
  out. It now stops on the first unanswered question and names the flag that answers it:

  ```text
  $ seamless init --local < /dev/null
  Error: "Web example" needs an interactive terminal, and this run does not have one.
  Pass --web=<id> to choose one (see `seamless templates list`), or --yes to take the
  recommended template.
  ```

  A run whose answers all come from flags is unaffected and works the same on a pipe as on a
  terminal. A terminal too narrow to render a prompt (a pty allocated without a size reports one
  column, which used to print one character per line) now warns instead of just looking broken.

- f725752: Generated compose files now publish every port on `127.0.0.1` instead of all interfaces. A scaffolded
  stack was reachable from any machine on the same network, which mattered most for the auth server:
  it is configured with `ALLOW_UNCREDENTIALED_DELIVERY_SECRETS=true` so `seamless login --local` can
  read OTP codes from the response, and that opt-in is honored before any service-token check. Anyone
  on the LAN could request a code for any user of the stack and read it. Postgres was exposed on the
  same terms, with the fixed credentials the compose file ships.

  Local development is unchanged: the browser, the CLI, and inter-container traffic all still work.

- ffe4331: Update the conformance harness for the removal of the admin bootstrap invite flow in
  seamless-auth-api. The verify stack now sets `OWNER_EMAIL` instead of
  `SEAMLESS_BOOTSTRAP_ENABLED`/`SEAMLESS_BOOTSTRAP_SECRET`, and the first-admin spec registers the
  owner address and asserts the admin role is granted at signup.
- 2d898e2: Fix conformance project routing when the checkout path contains a directory named with an `api/`
  segment. Playwright applies a `testMatch` regex to the absolute file path, so the `api` project's
  pattern also claimed every adapter and react spec, running browser tests in a project with no
  `baseURL`. Each project now scopes itself with `testDir` instead.
- c2e4e1b: Scaffold from seamless-templates v0.5.0, which teaches the express starter to read `DATABASE_URL` and
  negotiate TLS when the connection string carries `sslmode=require`. This is what turns on the managed
  bundled database wiring: the CLI already computed the connection string, but the pinned v0.4.0
  starter did not declare the placeholder, so nothing was written.

## 0.10.2

### Patch Changes

- 5c71d8c: Fix the released conformance smoke (`released-smoke`): bump the harness adapter's
  `@seamless-auth/express` pin from `^0.8.0` to `^0.9.0`. The published 0.8.0 still
  served the OTP/magic-link generate routes as `GET`, while the harness flows and
  `@seamless-auth/react` 0.5.0 both `POST` them, so every adapter (and downstream
  react) flow failed with `generate-email-otp -> 404`. 0.9.0 serves them as `POST`,
  matching what the source (`--local`) conformance already builds.

## 0.10.1

### Patch Changes

- 166afdd: Bump the pinned Seamless component versions the CLI pulls to their latest
  published tags: auth-api `v0.3.0` → `v0.4.0`, admin dashboard `v0.1.0` →
  `v0.3.0`, and the templates ref `v0.3.0` → `v0.4.0`.

## 0.10.0

### Minor Changes

- 46ed8dd: Let adopters choose how the admin console is hosted during `seamless init`.

  The old "Include Admin Dashboard?" / image-vs-source prompts are replaced by a
  single question with four options:

  - **Served by your API at /console** (recommended default) — the app backend
    proxies the console via the SDK's `createSeamlessConsoleProxy`, so it loads
    from the API's own origin. The scaffold sets `SERVE_ADMIN_CONSOLE=true` on the
    API, `SERVE_ADMIN_DASHBOARD=true` on the auth server, and adds the API origin
    to the auth server's `ORIGINS` so console passkey ceremonies verify. No
    separate admin container.
  - **Separate container** — official image or cloned source, as before, on
    `http://localhost:5174`.
  - **None** — no console is scaffolded.

  Each choice pre-configures the auth-server env, the app-backend env, the Docker
  Compose services, `seamless.config.json`, the success output, and `seamless
check` accordingly. Pins the auth API image to `v0.3.0` and the templates to
  `v0.3.0` (which env-gate the console proxy).

- e612a10: Enable `email_otp` in the scaffolded auth server's default login methods.

  The auth server's own default (`passkey,magic_link`) has no method the CLI can
  drive without a browser authenticator, so `seamless login` could not sign in to
  a freshly scaffolded local stack. `buildAuthEnv` now appends `email_otp` to
  `LOGIN_METHODS` (composing with the OAuth method when providers are configured),
  so email-OTP login works out of the box.

- 7fbaff0: Enable `ALLOW_UNCREDENTIALED_DELIVERY_SECRETS=true` in the scaffolded auth server env.

  Companion to the `email_otp` default: with it set, `seamless login --local`
  reads the OTP straight from the auth server's response instead of needing a mail
  provider, so signing in to a freshly scaffolded local stack works end to end.
  It's a dev-only escape hatch — the auth server ignores it under a production
  `NODE_ENV`, and the scaffold runs as development.

### Patch Changes

- 2e27156: Fix `seamless bootstrap-admin` to target the app API instead of the login profile's auth server.

  The bootstrap invite route (`/auth/internal/bootstrap/admin-invite`) and its
  delivery are exposed by the app API (the SeamlessAuth server adapter), not the
  auth server directly — the auth server does not serve that path. Previously
  `bootstrap-admin` fell back to the active profile's `instanceUrl`, so once a
  profile pointed at the auth server (as `seamless login` and the admin commands
  require), bootstrap requests 404'd.

  `bootstrap-admin` now resolves its target independently of any profile:
  `--api-url <url>` → `SEAMLESS_API_URL` → the local default `http://localhost:3000`.
  The `--profile` flag is removed from this command (it no longer affects the
  target; the bootstrap secret is still resolved from the local project).

- 3dbdc61: Reconcile documentation with actual behavior.

  - README: correct the Node requirement (24, per `.nvmrc`/`engines`, not 18);
    update `bootstrap-admin` docs to the `--api-url` → `SEAMLESS_API_URL` →
    `http://localhost:3000` resolution (the removed `--profile` flag and
    auth-server-profile wording are gone).
  - AGENTS.md: drop the `npm run typecheck`/`lint`/`format:check` commands that
    don't exist (there is no lint/format tooling yet); note the `--filter=<flow>`
    (`=` form) for `verify`; list the instance-management commands; remove the stale
    top-level `templates/` reference (templates live in the `seamless-templates`
    monorepo).
  - `package.json`: drop the dead `templates` entry from `files`.

  Closes #94.

- e81a07d: Make `seamless check` managed-aware and resilient to partial config.

  `checkCompose` dereferenced `config.docker.composeFile`, which is `null` for
  managed projects, so `seamless check` crashed with a `TypeError` on any managed
  scaffold. `check` now branches on `services.auth.mode === "managed"`: it validates
  the remote instance's `/health/status` and skips the Docker/compose/container
  checks (which don't apply remotely). It also wraps `JSON.parse` and guards missing
  service entries so a malformed or partial `seamless.config.json` prints a friendly
  message instead of a stack trace. The local console health check is derived from
  `services.admin.mode` (image/source → :5174, api → :3000/console, none/hosted →
  skipped).

  Closes #78.

- c4a0f93: Fix the conformance adapter flows to match the SDK's POST OTP/magic-link routes.

  `@seamless-auth/express` now serves OTP generate routes (and `/magic-link`) over
  POST, but the harness adapter flows still called them with GET, so every adapter
  spec failed at `generate-email-otp -> 404` once the stack came up. The adapter
  flows now POST `/auth/otp/generate-email-otp`, `/auth/otp/generate-login-email-otp`,
  and `/auth/magic-link`.

  Closes #111.

- 545aafc: Disable auth rate limits in the conformance stack.

  The conformance suite drives many OTP/registration/magic-link flows from a single
  IP and trips auth-api's dedicated per-IP limiters (which `RATE_LIMIT` doesn't
  tune), so the adapter layer failed with 429s once the stack came up. The verify
  compose now sets `DISABLE_AUTH_RATE_LIMITS=true` on the auth-api service — a
  dev-only flag (ignored under `NODE_ENV=production`) added in seamless-auth-api.

  Requires seamless-auth-api with `DISABLE_AUTH_RATE_LIMITS` support; conformance
  builds it from source, so no release is needed.

- f7e5b5d: Fix the conformance stack and surface container logs on failure.

  auth-api 0.3.0 requires `FRONTEND_URL` at startup (a required system config), which
  the verify compose never set — so the auth-api container exited on boot and every
  `conformance` run (here and in sibling repos calling the reusable workflow) aborted
  with a bare "docker failed" before any layer ran. `verify/docker-compose.verify.yml`
  now sets `FRONTEND_URL`, and `seamless verify` dumps recent container logs on a
  setup failure so a container that exits on startup is diagnosable instead of hidden.

  Closes #107.

- 54f1f02: Quote generated `.env` values that a dotenv parser would otherwise misread.

  `writeEnv` wrote bare `KEY=value`, so a value containing `#`, whitespace, quotes,
  a backslash, or a newline (e.g. a managed `API_SERVICE_TOKEN` or a pasted OAuth
  secret) produced a `.env` that dotenv truncates or mis-parses. Values that need
  it are now double-quoted and escaped, and `parseEnv`/`parseEnvString` unquote on
  read so the CLI round-trips its own output. Simple values (tokens, URLs, hex
  secrets) are still written bare.

  Closes #81.

- 943d13d: Harden the managed `init` flow.

  - **Explicit managed intent no longer silently scaffolds local.** When `--app` is
    given but there is no usable session (expired or control plane unreachable),
    `init` now fails with an actionable message instead of quietly scaffolding a
    self-hosted project and ignoring the flag. Without `--app`, a missing session or
    an unreachable control plane falls back to local with a clear warning (rather
    than aborting on transient network errors, as it previously did for non-reauth
    failures). Closes #79.
  - **Service-token rotation is now recoverable.** Rotation invalidates the app's
    previous token, so it runs after templates are copied (the likeliest failure
    point), and every step after it is guarded: if scaffolding fails post-rotation,
    the freshly issued token is printed so a deployed app can be re-wired instead of
    left bricked. The same guard covers `integrateExistingProject`. Closes #80.

- 9eaaf0e: Fix the conformance adapter crash: the dev service token was too short.

  `seamless verify` defaulted `API_SERVICE_TOKEN` to a 24-char constant, which the
  adapter reuses as its cookie secret; a newer `@seamless-auth/express` rejects a
  cookieSecret shorter than 32, so the adapter container exited and conformance
  failed after the stack came up. The dev service token and bootstrap secret
  defaults are now >=32 characters.

  Closes #109.

## 0.9.0

### Minor Changes

- 3de03ef: Add `seamless config oauth-providers <list|add|update|remove>` for per-provider OAuth management, backed by the auth API's dedicated provider routes (`GET`/`POST /system-config/oauth-providers`, `PATCH`/`DELETE /system-config/oauth-providers/:id`). Each command touches a single provider, so concurrent edits no longer clobber the whole `oauth_providers` array the way `config set oauth_providers` / `config apply` do. `add` and `update` accept an inline JSON object or `--file <path>`; `remove` confirms first (skip with `--yes`). Client secrets stay server-side: providers are referenced by `clientSecretEnv` and the secret value is never sent. The whole-config editor commands are unchanged.
- 9043643: Add `seamless login --local` for self-hosted and local instances. It asks the instance to return the email or phone OTP in the response body instead of sending it, then verifies with that code automatically, so logins work without a real mail or SMS provider. It only runs against local hosts and requires the auth API to run outside production with `ALLOW_UNCREDENTIALED_DELIVERY_SECRETS=true`.

### Patch Changes

- 26a78d6: Fix `seamless login` rejecting valid email OTP codes. Email OTPs are six letters, but the code prompt only accepted digits, so no real email code could be entered. The prompt is now channel-aware: it accepts a six-letter code (case-insensitive, normalized to uppercase) for email logins and a numeric code for phone logins, with matching placeholder text.
- f8dc6fc: Fix the conformance harness (`seamless verify --local`) failing to build after the ecosystem moved to Express 5 on Node 24. The verify adapter app pinned `express@^4`, but `@seamless-auth/express` now requires `express@>=5` as a peer, so installing the locally-built SDK tarball aborted with an `ERESOLVE` peer conflict and the Docker build failed. The adapter now depends on `express@^5.1.0` (and `@seamless-auth/express@^0.8.0`), and the verify Docker images are bumped from `node:20` to `node:24` to match the ecosystem's supported runtime.

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
