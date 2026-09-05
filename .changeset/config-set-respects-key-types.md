---
'seamless-cli': patch
---

Stop `config set` from changing the type of a string value, and check the key first.

`parseValue` ran `JSON.parse` on every value, so `config set app_name 123` sent the number
`123` and `config set rpid true` sent the boolean `true` for keys the instance types as
strings. `set` also skipped the `WRITABLE_KEYS` filter that `apply` applies, so a key the
instance's strict patch schema rejects was sent anyway and came back as an opaque failure.

String-typed keys (`app_name`, `rpid`, `access_token_ttl`, `session_idle_ttl`,
`refresh_token_ttl`) now take their value verbatim; every other key parses as JSON with the
existing fallback to a string. An unwritable key is refused before the request, naming the
keys that are writable.

That guard is only correct if the list is, and it had drifted: `authenticator_policy`,
`session_idle_ttl`, `max_concurrent_sessions`, and `magic_link_redirect_uris` are all
accepted by the instance but were missing from `WRITABLE_KEYS`, so `config apply` had been
silently dropping them. They are now included.
