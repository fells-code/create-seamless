---
"seamless-cli": minor
---

`seamless verify` now conformance-tests every web template in the registry. It runs the API and adapter layers once, then builds, serves, and drives each web template in turn, scoping the browser suite to the flows the template's manifest declares (`verify.flows`, e.g. `["oauth"]`). React specs are tagged by feature (`@login`, `@oauth`) so a template runs only its relevant flows; a template with no declared flows runs the full suite. `SEAMLESS_REACT_DIR` still overrides with a single template.
