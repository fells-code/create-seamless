---
'seamless-cli': minor
---

Move the scaffold onto the current Seamless ecosystem: auth API `v0.10.0`, admin dashboard `v0.5.0`,
and seamless-templates `v0.12.0`.

Three releases of auth API work land together. `v0.8.0` gives WebAuthn challenges their own store
with a five-minute expiry and one-time use, so a registration and a login can be outstanding at once
instead of clobbering each other, and it adds `AUTHENTICATOR_POLICY`, which decides attachment, user
verification, attestation, and whether a synced passkey may enrol. `v0.9.0` puts the lockout policy
and the per-IP and per-identity limiters on TOTP step-up, which had none of the three, and stops
running refresh tokens through bcrypt. `v0.10.0` drops the `sessions.refreshTokenHash` column the
previous release stopped writing.

A scaffold's compose file is built from the pinned release's `.env.example`, so a new project picks up
`AUTHENTICATOR_POLICY` along with `SESSION_IDLE_TTL`, `MAX_CONCURRENT_SESSIONS` and a commented
`TRUST_PROXY`, and `REFRESH_TOKEN_TTL` moves from `1h` to `1d`.

The admin dashboard bump keeps the standalone console (`--admin=image` and `--admin=source`) in step
with the one the API image now serves at `/console`, since `v0.10.0` embeds dashboard `v0.5.0` itself.
That release names the acting administrator separately from the subject in the events table, and
collects identity proofing before preparing a device replacement, which is what the API already
records and requires.

Templates `v0.12.0` moves the starters onto `@seamless-auth/react` `0.11.0`, `@seamless-auth/express`
`0.13.0` and `@seamless-auth/fastify` `0.4.0`. All three are 0.x minors, so the caret ranges the
starters carried could never have resolved to them and a scaffolded project stayed on the older
versions however long ago they were pinned. It also carries per-application auth cookie names read
from `AUTH_COOKIE_PREFIX`, so two Seamless apps on one host stop overwriting each other's session. The
manifest contract is unchanged, so nothing in `init` moves with it.

The conformance harness's adapters follow the same SDKs the starters now install:
`@seamless-auth/express` `^0.13.0` and `@seamless-auth/fastify` `^0.4.0`. Both stop repeating the
access and refresh tokens in the body of the response that sets them as `httpOnly` cookies, and both
forward a magic link's `redirectUri` to the API.
