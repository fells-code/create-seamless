---
'seamless-cli': minor
---

Move the scaffold onto auth API `v0.12.0`, admin dashboard `v0.6.0`, and seamless-templates `v0.13.0`.

`v0.11.0` puts passkey enrollment behind an access session. It is a breaking change to the wire
contract: `/webAuthn/register/start` and `/webAuthn/register/finish` used to accept the ephemeral
token the API mints from an email address alone, so anyone who knew an address could enroll a
credential against that account and sign in as its owner. Both routes read the access session now,
and enrollment no longer issues a session of its own, answering `200` with the credential instead.
The same release declares and validates the window on `GET /admin/users`, and adds organization
deletion along with a paged, searchable admin organization list. `v0.12.0` ships dashboard `v0.6.0`
inside the API image, which is what that dashboard release needs: it pages and searches organizations
on the server, gains a remove action, takes a date range on Overview and Security, and grows an
Authenticator Policy section.

The admin dashboard pin moves with it, so the standalone console (`--admin=image` and
`--admin=source`) serves the same release the API image serves at `/console`.

The enrollment change has no safe release order, so every side of it moves here at once. Templates
`v0.13.0` carries `@seamless-auth/react` `0.12.0`, `@seamless-auth/express` `0.14.0` and
`@seamless-auth/fastify` `0.5.0` in the starters, and the conformance harness's adapters take the
same `^0.14.0` and `^0.5.0`. The adapters forward the access session the API now requires; an older
one sends what this API refuses, so a scaffold pinned to either half alone would answer `401` at
enrollment. No shipped flow loses a step, because registration proves an address with an email OTP
and verifying it issues the session before the passkey screen appears.

The adapters also proxy `DELETE /admin/organizations/:organizationId`, and forward the query string
on `GET /admin/users` and `GET /internal/auth-events/login-stats`, which both dropped it, so the
dashboard's user search and its login statistics range now reach the API as sent.
