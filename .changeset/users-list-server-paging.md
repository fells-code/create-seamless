---
'seamless-cli': patch
---

Send `--limit` and `--offset` to the server on `seamless users list`.

Both flags were parsed and then dropped: `listUsers` called `GET /admin/users` with no
query, and the command sliced the single page the server returned (its own default of 50)
client-side. An `--offset` past that page printed "No users." while the summary line
reported a larger `total`, and `--json` ignored paging entirely, so a script could never
walk past the first 50 users.

The flags now travel as query params, which the API already honours, and `--json` returns
the same page the table does. A non-numeric or negative `--limit`/`--offset` is rejected
instead of being coerced to `NaN` and silently returning nothing.
