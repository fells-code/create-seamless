---
'seamless-cli': patch
---

Write the signing key id a managed instance actually publishes.

A managed scaffold hardcoded `JWKS_KID=dev-main`. Managed instances pin their kid per tier
(`trialkey1` for trials, `paidkey1` for paid), so the value was never the instance's own.
Nothing verifies against it, adapters resolve the key from the token header through the
remote JWKS, but they do warn on boot while it is the dev default, so every managed
scaffold produced an app that reported itself misconfigured.

`init` now reads the kid from the instance's `/.well-known/jwks.json`. If the instance
cannot be reached it keeps the old default, says so, and explains that nothing breaks
except the warning.
