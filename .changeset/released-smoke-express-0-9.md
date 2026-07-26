---
"seamless-cli": patch
---

Fix the released conformance smoke (`released-smoke`): bump the harness adapter's
`@seamless-auth/express` pin from `^0.8.0` to `^0.9.0`. The published 0.8.0 still
served the OTP/magic-link generate routes as `GET`, while the harness flows and
`@seamless-auth/react` 0.5.0 both `POST` them, so every adapter (and downstream
react) flow failed with `generate-email-otp -> 404`. 0.9.0 serves them as `POST`,
matching what the source (`--local`) conformance already builds.
