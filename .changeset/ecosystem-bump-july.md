---
"seamless-cli": minor
---

Move the scaffold onto the current Seamless ecosystem: auth API `v0.7.0`, admin dashboard `v0.4.0`,
and seamless-templates `v0.8.0` (which carries `@seamless-auth/react` `^0.8.0` in both React
starters, `@seamless-auth/express` `^0.12.0` in the Express starter, and `@seamless-auth/fastify`
`^0.3.0` in the Fastify starter).

A scaffolded project can now finish registration without a passkey. Registration used to end on a
screen with a single control, leaving anyone who did not want a passkey, or whose device could not
make one, with no way forward. The starters offer a skip when the instance has another login method
enabled, and say so plainly when it does not. That reads from `GET /system-config/public`, a new
unauthenticated route on the auth server that returns the configured login methods, so the sign-in
screens can offer what an instance actually has enabled instead of a hardcoded guess. The API, the
adapters, and the web templates all had to move together for it to work, which is why this bumps
them as a set.

`seamless init` now offers Fastify as a backend, listed as "Fastify (beta)" beside Express. It
serves the same surface as the Express starter on the same environment contract, including the
admin console at `/console` behind `SERVE_ADMIN_CONSOLE`. Two boot-time fixes land with it: an empty
`PORT=` in `.env` now falls back to 3000 rather than binding a random free port, and `pino-pretty`
moves to a runtime dependency so an install without dev dependencies boots. Both Express and Fastify
starters ship `.env.example` secret placeholders long enough to clear the adapter's 32 character
minimum, so the documented `cp .env.example .env && npm run dev` path boots. A project from
`seamless init` was already unaffected, because the CLI fills `COOKIE_SIGNING_KEY` itself.

Both React starters gain a protected `/session` route that shows the issued claims, roles,
organization context, step-up freshness, and registered passkeys, so the first authenticated screen
reads as an app rather than a `JSON.stringify` dump. Missing configuration now stops a scaffolded
project with a message naming the variable instead of surfacing later as a 500, and the Express
starter reports every configuration problem at once.

The auth API drops the admin bootstrap invite flow in favor of the `OWNER_EMAIL` grant the CLI
already writes, so the generated `.env` no longer carries `SEAMLESS_BOOTSTRAP_ENABLED`,
`SEAMLESS_BOOTSTRAP_SECRET`, or `SEAMLESS_AUTH_DEBUG_SECRETS`. `AVAILABLE_ROLES` now offers
`admin:read` and `admin:write` alongside bare `admin`, and assigning a role the instance does not
list is rejected rather than silently doing nothing. Postgres TLS is configurable through `DB_SSL`,
`DB_SSL_CA`, and `DB_SSL_REJECT_UNAUTHORIZED`, and `DB_URI` is accepted as a `DATABASE_URL` alias.

The conformance harness adapter moves to `@seamless-auth/express` `^0.12.0`, which is also what
proxies the new public system-config route. The breaking change in `0.11.0` splits `error` into
`errorCode` and `errorBody` on the handler result types, which only affects code importing handlers
from `@seamless-auth/core` directly; the adapter uses `createSeamlessAuthServer`, so it needed no
source change.
