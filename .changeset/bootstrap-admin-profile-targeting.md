---
"seamless-cli": minor
---

Target `bootstrap-admin` at the active profile's instance URL instead of requiring a local `seamless.config.json`. The command now resolves the instance from the active profile (respecting `--profile` and `SEAMLESS_PROFILE`), with `SEAMLESS_API_URL` as an override and `http://localhost:3000` as the fallback when no profile is configured. The bootstrap-secret auth flow is unchanged.
