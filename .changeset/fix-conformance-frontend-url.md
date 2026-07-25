---
"seamless-cli": patch
---

Fix the conformance stack and surface container logs on failure.

auth-api 0.3.0 requires `FRONTEND_URL` at startup (a required system config), which
the verify compose never set — so the auth-api container exited on boot and every
`conformance` run (here and in sibling repos calling the reusable workflow) aborted
with a bare "docker failed" before any layer ran. `verify/docker-compose.verify.yml`
now sets `FRONTEND_URL`, and `seamless verify` dumps recent container logs on a
setup failure so a container that exits on startup is diagnosable instead of hidden.

Closes #107.
