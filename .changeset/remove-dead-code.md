---
'seamless-cli': patch
---

Remove code nothing calls.

- `src/utils/writeEnv.ts`, an unused duplicate of `core/env.ts`'s `writeEnv` that still
  emitted unquoted values, the bug fixed in the real one.
- `buildJWKSConfig` in the docker generator, which had no callers and was the only user of
  `core/jwks.ts`, so that module went with it.
- `generateKid` in `core/secrets.ts`. `generateSecret` beside it stays; it is widely used.
- `setupDockerAuth` in the auth generator, unreachable because `generateAuthServer` is only
  ever called with `"local"`. It also wrote a compose file mounting `pgdata` at
  `/var/lib/postgresql/data`, which the pinned `postgres:18` ignores, so it had gone stale
  as well as unreachable.

With the unreachable branch gone, `generateAuthServer` no longer needs a mode, and its
`context: any` and `mode: "local" | "docker" | Symbol` parameters become a plain `root:
string`.
