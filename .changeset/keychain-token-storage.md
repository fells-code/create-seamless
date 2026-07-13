---
"seamless-cli": minor
---

Store session tokens in the OS keychain (macOS Keychain, Windows Credential
Manager, Linux Secret Service) via `@napi-rs/keyring` instead of on disk. Tokens
are scoped per profile (keyed by profile name and instance URL) so multiple
instances never collide, and the refresh token, the durable secret, never
touches config or logs. `seamless profile remove` now clears the profile's
keychain entry. When no keychain is available (for example headless CI), the CLI
reads a refresh token from `SEAMLESS_REFRESH_TOKEN` if set and otherwise fails
with a clear, documented error rather than writing secrets to disk.
