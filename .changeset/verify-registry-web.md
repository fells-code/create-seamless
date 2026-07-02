---
"seamless-cli": patch
---

`seamless verify` now resolves the web template to conformance-test from the seamless-templates registry (the first runnable web template) instead of a hardcoded path. SEAMLESS_REACT_DIR still overrides with a direct template path, and SEAMLESS_TEMPLATES_DIR points at a local templates checkout. Running the browser suite against every web template is a follow-up.
