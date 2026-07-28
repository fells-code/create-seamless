---
"seamless-cli": minor
---

Scaffolding now requires `init`. An unrecognized command reports itself and exits instead of being
treated as a project name, so `seamless verfy` no longer silently creates a directory called
`verfy` and drops into the interactive scaffold. The error names `seamless init <name>` for anyone
who was using the old shortcut.

Ctrl-C is handled everywhere. Clack answers an interrupted prompt with a symbol, which several
prompts cast straight to a string; that surfaced as a `TypeError` mid-scaffold, or as "Selected
template Symbol(...) is not in the registry". Every prompt in init, the OAuth setup, the managed
application picker, and `bootstrap-admin` now cancels cleanly and exits 130.

`init` no longer leaves a project directory behind. Any failure or cancellation after the directory
is created removes it, including a Ctrl-C during a download or a git clone, so a retry is not
blocked by "Directory already exists". Only a directory the command itself created is ever removed,
never an existing one and never the working directory.

Declining the service token rotation prompt, or cancelling the application picker, now cancels the
whole command rather than returning quietly part-way through.
