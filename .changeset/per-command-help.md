---
"seamless-cli": minor
---

Add per-command help. Every command now answers `-h` / `--help` with usage, flags, subcommands, and
examples scoped to that command (`seamless init -h`, `seamless verify --help`), and
`seamless help <command>` prints the same thing. The help text lives in one registry
(`src/commands/helpTopics.ts`) that both the full `seamless --help` output and the per-command
output render from, so a flag is documented once and appears in both.

The help check runs before a command parses its own arguments, so `seamless init -h` prints help
instead of treating `-h` as a project name. A `--` separator ends the check, so a command can still
take a literal `-h` value (`seamless config set key -- -h`).
