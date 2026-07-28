---
'seamless-cli': patch
---

Fix conformance project routing when the checkout path contains a directory named with an `api/`
segment. Playwright applies a `testMatch` regex to the absolute file path, so the `api` project's
pattern also claimed every adapter and react spec, running browser tests in a project with no
`baseURL`. Each project now scopes itself with `testDir` instead.
