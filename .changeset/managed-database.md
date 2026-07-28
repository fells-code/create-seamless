---
"seamless-cli": minor
---

Connecting a project to a managed application now wires up its bundled database. `init` reads the
application's database and writes `DATABASE_URL` into `api/.env` as
`postgres://USER:PASSWORD@host:port/db?sslmode=require`.

The user and password stay as literal placeholders. The control plane only returns them for
`?reveal=true`, which this CLI never asks for, so a live database credential never reaches the
developer's disk or terminal: they copy those from the dashboard. Anything printed as a connection
string has its userinfo masked regardless.

An application whose database is still provisioning produces a warning rather than a failure, and the
database is read before the service token is rotated so a missing one is never reported against a
project whose old token has already been invalidated. Running `init` inside an existing project adds
`DATABASE_URL` only when there is not one already, so a working connection string is never replaced
by a placeholder.

This needs the templates release that teaches the express starter to read `DATABASE_URL` and
negotiate TLS. Until `SEAMLESS_TEMPLATES_REF` is bumped to it, the value is computed but the pinned
starter does not declare the placeholder, so nothing is written.
