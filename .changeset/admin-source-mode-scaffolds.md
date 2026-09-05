---
'seamless-cli': patch
---

Make `--admin=source` produce a stack that runs.

"Separate container, clone repo for modification" wrote `build: ./admin` into the compose
file and recorded `path: "./admin"` in `seamless.config.json`, but nothing ever created
`admin/`. `docker compose up` failed on a missing build context, and the success output
said nothing about it, so a first-class menu option scaffolded a project that could not
start.

`init` now unpacks the admin dashboard into `admin/` for that mode, from the same tag the
published image is built from, so both admin modes scaffold the same dashboard. It arrives
as plain files rather than a git clone, which is what a directory destined for the
developer's own repository wants, and needs no git binary. Override the ref with
`SEAMLESS_ADMIN_DASHBOARD_REF`, or scaffold from a local checkout with
`SEAMLESS_ADMIN_DASHBOARD_DIR`.

The fetch runs before the compose file is written, so a failed download stops the scaffold
instead of leaving a project that cannot come up, and the success output now points at
`admin/`.
