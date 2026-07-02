---
"seamless-cli": minor
---

When the OAuth template is selected, `seamless init` now prompts for OIDC providers (Google, GitHub, Microsoft, GitLab) and their client id/secret, then wires them into the scaffolded auth server: OAUTH_PROVIDERS config, a per-provider `*_CLIENT_SECRET` env var, the `oauth` login method, and the `http://localhost:5173/oauth/callback` redirect URI. Providers left without credentials are scaffolded disabled with a printed next-steps note. Apple is documented as manual (its client secret is a signed JWT and it has no userinfo endpoint). The scaffold now also generates `REFRESH_TOKEN_LOOKUP_SECRET`, `TOTP_SECRET_ENCRYPTION_KEY`, and `OAUTH_STATE_SECRET` (previously left empty, falling back to the service token), and adds a healthcheck to the generated web container.
