---
"seamless-cli": minor
---

Add admin verbs for users and organizations (requires an admin role).
`seamless users` covers `list` (with client-side `--limit`/`--offset` paging and
`--json`), `delete <id>` (with confirmation), `credentials <id>` (from the admin
user detail endpoint), and `prepare-device-replacement <id>` for admin-assisted
recovery. `seamless org` covers `list`, `create`, `get`, and `update`, and
`seamless org members` covers `list`, `add` (by `--user` id or `--email`, with
`--roles`/`--scopes`), `update`, and `remove` (with confirmation). Every command
surfaces a 403 as a clear permission error, and device replacement explains the
step-up requirement when the CLI session is not elevated. Accepts `--profile`
and honors `SEAMLESS_PROFILE`.
