---
"seamless-cli": patch
---

Make `seamless check` managed-aware and resilient to partial config.

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
