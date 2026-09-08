---
'seamless-cli': minor
---

Move the scaffold onto auth API `v0.12.0` and admin dashboard `v0.6.0`.

`v0.11.0` puts passkey enrollment behind an access session. It is a breaking change to the wire
contract: the API refuses the pre-auth token enrollment used to accept, so an ephemeral token can no
longer enroll a credential against an account and then sign in as its owner. Enrollment also stops
issuing a session of its own, answering `200` with the credential instead. The same release declares
and validates the window on `GET /admin/users`, and adds organization deletion along with a paged,
searchable admin organization list. `v0.12.0` ships dashboard `v0.6.0` inside the API image, which is
what that dashboard release needs: it pages and searches organizations on the server, gains a remove
action, takes a date range on Overview and Security, and grows an Authenticator Policy section.

The admin dashboard pin moves with it, so the standalone console (`--admin=image` and
`--admin=source`) serves the same release the API image serves at `/console`.

The conformance harness's adapters move to `@seamless-auth/express` `^0.14.0` and
`@seamless-auth/fastify` `^0.5.0`, which is the other half of the enrollment change: they forward the
access session the API now requires. They also proxy `DELETE /admin/organizations/:organizationId`,
and forward the query string on `GET /admin/users` and `GET /internal/auth-events/login-stats`, which
both dropped it, so the dashboard's user search and its login statistics range now reach the API as
sent.

**A scaffolded project needs the next seamless-templates release to enroll a passkey.**
`SEAMLESS_TEMPLATES_REF` stays at `v0.12.0`, whose API starters pin `@seamless-auth/express`
`^0.13.0` and `@seamless-auth/fastify` `^0.4.0`. Those are the adapters from before the enrollment
change, and a caret on a `0.x` version cannot reach `0.14.0` or `0.5.0`, so a project scaffolded
against this release runs a new API behind an old adapter and passkey enrollment answers `401` until
templates publishes with the new pins and `SEAMLESS_TEMPLATES_REF` follows. Email OTP and magic link
sign-in are unaffected. The conformance harness pins its own adapters, so it exercises the matched
pair and will not show this.
