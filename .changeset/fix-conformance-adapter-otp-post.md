---
"seamless-cli": patch
---

Fix the conformance adapter flows to match the SDK's POST OTP/magic-link routes.

`@seamless-auth/express` now serves OTP generate routes (and `/magic-link`) over
POST, but the harness adapter flows still called them with GET, so every adapter
spec failed at `generate-email-otp -> 404` once the stack came up. The adapter
flows now POST `/auth/otp/generate-email-otp`, `/auth/otp/generate-login-email-otp`,
and `/auth/magic-link`.

Closes #111.
