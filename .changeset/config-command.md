---
"seamless-cli": minor
---

Add `seamless config`, config-as-code for an instance's system configuration
(requires an admin role). `config get [key] [--json]` reads the config from `GET
/system-config/admin`, `config set <key> <value>` writes one key via `PATCH
/system-config/admin` (the value is parsed as JSON, falling back to a string, so
TTLs, arrays, booleans, and numbers all work), and `config roles` lists the
instance's roles. `config diff <file>` shows how a local JSON config file
differs from the instance, and `config apply <file>` applies the delta after a
confirmation prompt, with `--dry-run` to preview. Read-only or unknown keys in a
file are ignored on apply, and a non-admin user gets a clear permission error.
Accepts `--profile` and honors `SEAMLESS_PROFILE`.
