---
"seamless-cli": minor
---

`init` now asks for your email and writes it to the scaffolded auth server as `OWNER_EMAIL`. The auth
server grants the admin role at account creation to a signup matching that address, so the local flow
is `init`, `docker compose up`, register. When you are signed in to the portal, the prompt defaults to
that account's email.

`seamless bootstrap-admin` is removed. It existed to mint the first admin invite, which the owner
grant now covers, and the scaffolded stack no longer enables the bootstrap route or carries a
bootstrap secret. `seamless verify` keeps its own bootstrap secret for the conformance stack and is
unaffected.

The grant applies at signup only, so changing `OWNER_EMAIL` after an account exists promotes nobody.
The success output and the README both say so.
