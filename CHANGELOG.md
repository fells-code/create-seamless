# seamless-cli

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
