---
"seamless-cli": patch
---

Scaffold from seamless-templates v0.5.0, which teaches the express starter to read `DATABASE_URL` and
negotiate TLS when the connection string carries `sslmode=require`. This is what turns on the managed
bundled database wiring: the CLI already computed the connection string, but the pinned v0.4.0
starter did not declare the placeholder, so nothing was written.
