---
'seamless-cli': patch
---

Give `seamless verify` a build cache in CI, and stop paying for provenance attestations
nothing reads.

The conformance job spends nearly all of its time building Docker images, and none of it
running tests. On the run that prompted this, `Run seamless verify` was 28m02s and the
tests inside it took 23.7 seconds. Every image is rebuilt from scratch on every run,
because CI has no Docker layer cache, and the host-side npm caches do nothing for a build
that happens inside Docker.

`seamless verify` now layers an extra compose file over the base one when
`SEAMLESS_VERIFY_COMPOSE_OVERRIDE` is set. CI points it at `verify/docker-compose.cache.yml`,
which attaches a `type=gha` build cache scoped per service, and per web template for the
react image since each template is different source. Nothing changes for a local run: the
variable is unset, the base compose file is used as it always was, and `type=gha` would be
an error outside Actions anyway.

The Dockerfiles were already ordered for this. Each installs dependencies from a lockfile
before copying source, so a source change leaves the expensive layer intact and only a
lockfile change invalidates it.

Also sets `BUILDX_NO_DEFAULT_ATTESTATIONS` in the workflow. The images are thrown away when
the job ends, so the provenance attestation buys nothing, and on that same run
`resolving provenance for metadata file` took 301s by itself.
