---
"seamless-cli": patch
---

`seamless verify` now prints a consolidated summary report at the end of the run:
the seamless package versions under test (source versions for `--local`, the
declared pins for released runs), one line per conformance layer (API / adapter and
each web template) with its pass/fail status and duration, and an overall verdict.
It is printed after teardown so it stays on screen without scrolling back through
the phase output.
