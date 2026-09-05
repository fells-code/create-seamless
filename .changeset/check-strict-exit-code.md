---
'seamless-cli': minor
---

Add `seamless check --strict`, which exits non-zero when a check fails.

`check` is what you would reach for in a health-check script or a CI gate, and it always
exited 0: an empty directory, a stack that is down, and a fully healthy project were
indistinguishable to anything reading the exit status.

`--strict` exits 1 if any check failed, reporting how many. Without it the exit status is
unchanged, because this output has been parsed by scripts since before the flag existed.

Every check still runs either way. A gate that stops at the first problem hides the rest,
and the whole picture is the reason to run `check` at all.
