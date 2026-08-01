---
"seamless-cli": minor
---

Make `seamless init` template flags discoverable, predictable, and safe to get wrong.

Add `seamless templates list [--json]`, which prints every starter `init` can scaffold with its id,
kind, framework, selecting flags, and status. It reads the same registry `init` does (so
`SEAMLESS_TEMPLATES_DIR` and `SEAMLESS_TEMPLATES_REF` apply) and needs no login, so the available
templates no longer have to be looked up in the source.

Every template now answers to `--<id>` as well as its shorter `--<alias>`, so `seamless init
--react-vite` works alongside `--basic`, and the api starters (`--express`, `--fastify`) have a flag
for the first time. The "unknown option" error lists both spellings and points at
`seamless templates list`.

Template flags are also resolved before `init` creates a directory or asks whether to write into one
that is not empty. An unrecognized or conflicting flag now fails immediately instead of surfacing
only after the overwrite confirmation.
