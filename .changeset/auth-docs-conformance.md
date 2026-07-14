---
"seamless-cli": patch
---

Document the CLI authentication commands in the README (profiles, login, whoami,
sessions, logout, config, and the users and organizations admin verbs), including
per-platform keychain behavior and the headless `SEAMLESS_REFRESH_TOKEN`
fallback. Add a gated end-to-end test that drives the real login flow, an
authenticated call, transparent refresh, and refresh-reuse rejection against a
running instance (enabled with `SEAMLESS_E2E_URL`), plus an opt-in rate-limit
check.
