---
"seamless-cli": minor
---

Scaffold web and api starters from the seamless-templates registry instead of hardcoded per-framework generators. The CLI now reads the registry to build its prompts, downloads the selected templates from the templates monorepo at a pinned ref, and applies each template's env contract. Adding a new framework is a templates-repo change, not a CLI change. Set SEAMLESS_TEMPLATES_DIR to scaffold from a local checkout, or SEAMLESS_TEMPLATES_REF to pin a different ref.
