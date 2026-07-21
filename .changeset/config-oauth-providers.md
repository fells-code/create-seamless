---
"seamless-cli": minor
---

Add `seamless config oauth-providers <list|add|update|remove>` for per-provider OAuth management, backed by the auth API's dedicated provider routes (`GET`/`POST /system-config/oauth-providers`, `PATCH`/`DELETE /system-config/oauth-providers/:id`). Each command touches a single provider, so concurrent edits no longer clobber the whole `oauth_providers` array the way `config set oauth_providers` / `config apply` do. `add` and `update` accept an inline JSON object or `--file <path>`; `remove` confirms first (skip with `--yes`). Client secrets stay server-side: providers are referenced by `clientSecretEnv` and the secret value is never sent. The whole-config editor commands are unchanged.
