---
"seamless-cli": minor
---

`seamless verify` now exercises the Fastify starter. The scaffold has offered a Fastify API since the
templates bump, but the conformance harness only ever drove the Express adapter, so a green run said
nothing about whether a Fastify-scaffolded project actually worked.

The stack gains a second adopter backend (`verify/adapter-fastify-app`, on port 3001) built on
`@seamless-auth/fastify`, a twin of the Express one: same routes, same env contract, same capture
transport. The existing adapter specs run against both without being duplicated, since the two
Playwright projects share a test directory and differ only in which backend they point at. The
conformance grid gains an `adapter-fastify` column, so a failure in one framework is attributable to
that framework.

`--api-only` and `--no-react` are unchanged, and `--local` builds and packs `@seamless-auth/fastify`
from source alongside core and express.
