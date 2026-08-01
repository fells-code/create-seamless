---
"seamless-cli": patch
---

`seamless init` no longer hangs when it has no terminal to prompt on. Run on a pipe, it used to
render a prompt nobody could answer and wait forever, so a CI step failed only when its job timed
out. It now stops on the first unanswered question and names the flag that answers it:

```text
$ seamless init --local < /dev/null
Error: "Web example" needs an interactive terminal, and this run does not have one.
Pass --web=<id> to choose one (see `seamless templates list`), or --yes to take the
recommended template.
```

A run whose answers all come from flags is unaffected and works the same on a pipe as on a
terminal. A terminal too narrow to render a prompt (a pty allocated without a size reports one
column, which used to print one character per line) now warns instead of just looking broken.
