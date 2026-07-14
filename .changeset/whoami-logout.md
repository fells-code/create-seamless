---
"seamless-cli": minor
---

Add `seamless whoami` and `seamless logout`. `whoami` calls `GET /users/me`
through the authenticated client and prints the identity (sub, email, roles)
alongside the active profile and instance URL, failing cleanly with a "not
logged in" message when there is no session. `logout` ends the current session
with `DELETE /logout` and then clears the profile's keychain tokens; `logout
--all` revokes every session for the user with `DELETE /logout/all` first. Both
commands accept `--profile` (and honor `SEAMLESS_PROFILE`) and always clear the
local tokens even if the server session was already gone.
