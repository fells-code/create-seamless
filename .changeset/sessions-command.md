---
"seamless-cli": minor
---

Add `seamless sessions` to list and revoke the logged-in user's active sessions.
`seamless sessions` (or `sessions list`) calls `GET /sessions` and renders each
session's id, device or user agent, IP, and last-used time, marking the current
session. `seamless sessions revoke <id>` calls `DELETE /sessions/:id`, and
`seamless sessions revoke --all` calls `DELETE /sessions`. Revoking the current
session, or all sessions, prompts for confirmation first and then clears the
local keychain tokens, since that request signs you out. Accepts `--profile` and
honors `SEAMLESS_PROFILE`.
