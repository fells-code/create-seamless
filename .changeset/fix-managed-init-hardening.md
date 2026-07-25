---
"seamless-cli": patch
---

Harden the managed `init` flow.

- **Explicit managed intent no longer silently scaffolds local.** When `--app` is
  given but there is no usable session (expired or control plane unreachable),
  `init` now fails with an actionable message instead of quietly scaffolding a
  self-hosted project and ignoring the flag. Without `--app`, a missing session or
  an unreachable control plane falls back to local with a clear warning (rather
  than aborting on transient network errors, as it previously did for non-reauth
  failures). Closes #79.
- **Service-token rotation is now recoverable.** Rotation invalidates the app's
  previous token, so it runs after templates are copied (the likeliest failure
  point), and every step after it is guarded: if scaffolding fails post-rotation,
  the freshly issued token is printed so a deployed app can be re-wired instead of
  left bricked. The same guard covers `integrateExistingProject`. Closes #80.
