---
"seamless-cli": patch
---

Fix `seamless bootstrap-admin` to target the app API instead of the login profile's auth server.

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
