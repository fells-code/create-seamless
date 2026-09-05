---
'seamless-cli': patch
---

Make transparent token refresh survive rotation, concurrency, and a persistent 401.

Four problems, all sharpened by the same instance behaviour: `/refresh` rotates the refresh
token on every call, and a second use of a spent one is read as theft and revokes the whole
session chain.

- **A refresh that renewed only the access token wiped the session.**
  `tokensFromAuthResponse` required both tokens, which is right for a login but not for a
  refresh: the response schema marks both optional. A new `tokensFromRefreshResponse` keeps
  the current refresh token when the instance does not send a new one.
- **Concurrent 401s fired parallel refreshes.** With reuse detection that does not merely
  race, it logs the developer out. Refreshes are now single-flight, and a request whose
  token was already replaced while it was in flight simply retries instead of refreshing
  again.
- **A headless run broke itself after the first rotation.** `SEAMLESS_REFRESH_TOKEN` is read
  fresh on every run, so a rotated token written to the keychain was never read back, and
  the next run re-sent the spent one, revoking the session. The CLI no longer writes it, and
  a rejected environment token now explains rotation and names the command that issues a new
  one.
- **A 401 that survived a refresh was returned verbatim**, leaving commands to report an
  opaque failure rather than saying the session is gone. It now raises `ReauthRequired`.
