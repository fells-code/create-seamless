---
'seamless-cli': patch
---

Add `--json` to `seamless whoami` and `seamless sessions list`.

`config get/roles`, `users list/credentials`, and `org list/get/members list` all had it;
these two, both natural scripting targets, did not, so reading an identity or a session id
from a script meant parsing formatted output.

Both print machine-readable output and nothing else: an empty session list is `[]` rather
than "No active sessions.", and `whoami --json` reports a missing `sub` or `email` as
`null` instead of the `(unknown)` the table shows.
