---
"seamless-cli": patch
---

Reconcile documentation with actual behavior.

- README: correct the Node requirement (24, per `.nvmrc`/`engines`, not 18);
  update `bootstrap-admin` docs to the `--api-url` → `SEAMLESS_API_URL` →
  `http://localhost:3000` resolution (the removed `--profile` flag and
  auth-server-profile wording are gone).
- AGENTS.md: drop the `npm run typecheck`/`lint`/`format:check` commands that
  don't exist (there is no lint/format tooling yet); note the `--filter=<flow>`
  (`=` form) for `verify`; list the instance-management commands; remove the stale
  top-level `templates/` reference (templates live in the `seamless-templates`
  monorepo).
- `package.json`: drop the dead `templates` entry from `files`.

Closes #94.
