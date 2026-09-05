---
'seamless-cli': patch
---

Stop `seamless sessions` from hiding a session it could not read.

`toSessionInfo` returns `null` for a row without a usable `id`, and `listSessions` filtered
those out, so a session the instance sent simply did not appear. That is the wrong way for
this command to be wrong: an unlisted session is one the developer still has and cannot
revoke, and the shorter list looked authoritative.

`listSessions` now returns the sessions alongside a count of what it could not read, and
the command reports that count on stderr, so it cannot corrupt the JSON that `--json`
writes to stdout.
