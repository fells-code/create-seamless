---
"seamless-cli": patch
---

Fix the scaffolded database failing to start on PostgreSQL 18.

The PostgreSQL 18 bump moved the image tag but not the volume mount. PostgreSQL 18+ images store data
in a major-versioned subdirectory (`/var/lib/postgresql/18/docker`), so a mount at
`/var/lib/postgresql/data` is ignored and the container refuses to start, restart-looping on:

```
Error: in 18+, these Docker images are configured to store database data in a
       format which is compatible with "pg_ctlcluster" ...
       Counter to that, there appears to be PostgreSQL data in:
         /var/lib/postgresql/data (unused mount/volume)
```

The generated `docker-compose.yml` now mounts `pgdata:/var/lib/postgresql`. See
docker-library/postgres#1259.

This only ever affected projects scaffolded from the unreleased PostgreSQL 18 change, so no published
version of the CLI produced a broken scaffold.
