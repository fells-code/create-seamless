---
'seamless-cli': patch
---

Update the conformance harness for the removal of the admin bootstrap invite flow in
seamless-auth-api. The verify stack now sets `OWNER_EMAIL` instead of
`SEAMLESS_BOOTSTRAP_ENABLED`/`SEAMLESS_BOOTSTRAP_SECRET`, and the first-admin spec registers the
owner address and asserts the admin role is granted at signup.
