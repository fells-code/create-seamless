---
"seamless-cli": patch
---

Point the conformance harness at the seamless-templates monorepo. `seamless verify` now resolves the React web template from `../seamless-templates/templates/web/react-vite` by default (still overridable with `SEAMLESS_REACT_DIR`), and the reusable `verify-conformance.yml` workflow checks out `seamless-templates` (input `templates-ref`) instead of the standalone starter repo.
