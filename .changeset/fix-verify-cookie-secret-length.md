---
"seamless-cli": patch
---

Fix the conformance adapter crash: the dev service token was too short.

`seamless verify` defaulted `API_SERVICE_TOKEN` to a 24-char constant, which the
adapter reuses as its cookie secret; a newer `@seamless-auth/express` rejects a
cookieSecret shorter than 32, so the adapter container exited and conformance
failed after the stack came up. The dev service token and bootstrap secret
defaults are now >=32 characters.

Closes #109.
