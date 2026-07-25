---
"seamless-cli": patch
---

Disable auth rate limits in the conformance stack.

The conformance suite drives many OTP/registration/magic-link flows from a single
IP and trips auth-api's dedicated per-IP limiters (which `RATE_LIMIT` doesn't
tune), so the adapter layer failed with 429s once the stack came up. The verify
compose now sets `DISABLE_AUTH_RATE_LIMITS=true` on the auth-api service — a
dev-only flag (ignored under `NODE_ENV=production`) added in seamless-auth-api.

Requires seamless-auth-api with `DISABLE_AUTH_RATE_LIMITS` support; conformance
builds it from source, so no release is needed.
