---
'seamless-cli': patch
---

Stop reading every failed code verification as a wrong code.

`completeLogin` handled only `200` and `429` specially, so a `500`, a `423` lockout, a
`403` for a login method disabled mid-flow, and a `400` all fell through to "That code was
not accepted", spent an attempt, and ended three attempts later on a generic message with
the real reason nowhere in sight.

Only a `401` is retried now, because that is how the instance answers a genuinely wrong
code. Everything else stops immediately and reports what the instance said, with a lockout
formatted the same way `/login` already formats it.

Separately, when the five minute login window lapses while a code is being typed, the CLI
drops that code and requests a new one. It now says so rather than appearing to ignore
what was entered.
