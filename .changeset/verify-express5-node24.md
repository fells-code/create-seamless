---
"seamless-cli": patch
---

Fix the conformance harness (`seamless verify --local`) failing to build after the ecosystem moved to Express 5 on Node 24. The verify adapter app pinned `express@^4`, but `@seamless-auth/express` now requires `express@>=5` as a peer, so installing the locally-built SDK tarball aborted with an `ERESOLVE` peer conflict and the Docker build failed. The adapter now depends on `express@^5.1.0` (and `@seamless-auth/express@^0.8.0`), and the verify Docker images are bumped from `node:20` to `node:24` to match the ecosystem's supported runtime.
