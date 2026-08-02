---
"seamless-cli": minor
---

Scaffold new projects on PostgreSQL 18, and run the conformance harness on it too.

`seamless init` generated a stack pinned to `postgres:17` while the verify harness ran `postgres:16`.
Both are now `postgres:18`, so what the harness certifies is the major a fresh scaffold actually
gets.

This does not touch an existing project. The image is written into each scaffold's own
`docker-compose.yml` at generation time, so a project keeps whatever major it was scaffolded with and
its data directory is never pulled out from under it. Only newly scaffolded projects get 18, on a
fresh volume. Upgrading an existing project is a deliberate act: change the image in its
`docker-compose.yml`, and dump and restore the volume, since PostgreSQL will not start against a data
directory written by a different major.
