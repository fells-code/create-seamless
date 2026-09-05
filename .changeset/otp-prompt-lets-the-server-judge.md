---
'seamless-cli': patch
---

Stop the login prompt from deciding what a valid one-time code looks like.

The email branch required `/^[A-Za-z]{6}$/` and the phone branch `/^\d{4,8}$/`, so a code
outside those shapes was refused locally, before the instance ever saw it, with no way to
override. The email code was also force-uppercased on the way out. Both encode a detail
that belongs to the instance: the shape it issues can change, and it normalizes email OTP
case itself, so the uppercasing was redundant at best and corrupting for a case-sensitive
code.

The prompt now refuses only an empty answer and sends what was typed, trimmed. The
placeholder still shows today's shape as a hint.
