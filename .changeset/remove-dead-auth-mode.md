---
"seamless-cli": patch
---

Stop writing `AUTH_MODE` into scaffolded projects.

The scaffold set `AUTH_MODE=server` in the auth server env and on the admin console
container, but nothing reads it: not the auth API, not the admin dashboard (its
entrypoint takes only `API_URL`), and not the web or api templates. It was config that
looked meaningful and meant nothing.
