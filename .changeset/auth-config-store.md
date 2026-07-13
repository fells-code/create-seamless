---
"seamless-cli": minor
---

Add a multi-profile config store and `seamless profile` commands so the CLI can
target multiple Seamless Auth instances (self-hosted, managed tenant, local dev)
under named profiles. Profiles live in `~/.config/seamless/config.json`
(respecting `XDG_CONFIG_HOME`) and hold no secrets. New subcommands: `profile
list`, `profile add`, `profile use`, and `profile remove`. The active profile can
be selected per command with `--profile <name>` or the `SEAMLESS_PROFILE`
environment variable, defaulting to the `default` profile.
