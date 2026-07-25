---
"seamless-cli": minor
---

Enable `ALLOW_UNCREDENTIALED_DELIVERY_SECRETS=true` in the scaffolded auth server env.

Companion to the `email_otp` default: with it set, `seamless login --local`
reads the OTP straight from the auth server's response instead of needing a mail
provider, so signing in to a freshly scaffolded local stack works end to end.
It's a dev-only escape hatch — the auth server ignores it under a production
`NODE_ENV`, and the scaffold runs as development.
