---
"seamless-cli": minor
---

Match the list windows the auth API now enforces, and let `org list` page.

The API validates the window on its admin list routes: `limit` is 1 to 100 and
`offset` is 0 or more. The CLI checked both flags against one range with a floor
of zero, which was right for `--offset` and wrong for `--limit`, so
`users list --limit 0` and `users list --limit 500` were sent and came back as a
400 naming neither the flag nor the bound. Each flag is checked against its own
range now, and the message says which one was wrong and what it accepts.

`--limit 0` is therefore an error rather than a request for nothing. Asking the
server for zero rows and reporting "No users." said there were none when the CLI
had not looked, which is worse than saying the flag is out of range.

`org list` gains `--limit`, `--offset` and `--search`. It sent no window at all,
so once the API started defaulting to 50 it printed the first 50 organizations
and then a count of every organization, claiming rows it had not shown. It now
reports where the page sits, the way `users list` already did, and `--search`
matches the name and slug server-side.
