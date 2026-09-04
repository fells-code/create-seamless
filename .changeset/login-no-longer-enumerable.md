---
'seamless-cli': patch
---

Stop reading a `401` from `/login` as "no such account", and stop claiming an account
exists when the instance will not say.

`POST /login` no longer answers `401`. An identifier with no usable account, which used
to cover unknown, unverified, and no-permitted-method, now gets `200` and a decoy pre-auth
token so the response cannot be used to test whether an account exists. Two branches in
`completeLogin` read that `401` and are now unreachable: the "not verified yet" message
and "No account was found for X". Both are removed, because there is no longer an answer
for them to read.

The messages that surrounded them were making a claim the CLI can no longer support. "A
code was sent to X" is now "If an account exists for X, a code is on its way", and "This
account cannot use email otp login" is now phrased as what the instance offered, since
that method list comes back for an unknown identifier too.

An unknown identifier therefore runs the ordinary flow and fails at the code step. That is
the intended behaviour and not something the CLI can shortcut, so the final error now says
so: it names the identifier and points at registering, instead of "Could not verify a
code" with no explanation of the likeliest reason.

`423` is now reported on its own terms, with how long to wait when the instance says.
Previously it fell through to "Login request failed (423)". It is also the one answer left
that does imply an account exists, which is a deliberate and documented tradeoff on the
API side.

Adds `verify/harness/api/loginEnumeration.spec.ts` to the conformance matrix, pinning the
guarantee against a running instance: an unknown identifier gets the same status and the
same fields as a registered one, the same identifier keeps the same subject and the same
method list across attempts, the OTP send reports success and sends nothing, the verify
fails the way a wrong code fails, and a credential id that cannot exist is refused
identically for both.

The `loginMethods` assertion is the one worth reading. It is deliberately not equality
between one account and one decoy: that list is filtered by what an account can do, and a
decoy's capabilities are derived per identifier, so any two can legitimately differ. What
must hold is that a real account's list is one a decoy can also produce, which is what
makes a narrow list stop being proof of existence. The spec asserts that over a sample.
