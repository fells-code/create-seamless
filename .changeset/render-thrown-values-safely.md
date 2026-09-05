---
'seamless-cli': patch
---

Stop printing `Error: undefined` when something other than an `Error` is thrown.

The top-level handler in `index.ts` and the catch blocks in `whoami` and `sessions` all
read `.message` off the thrown value, which `throw` does not guarantee exists. A rejected
promise carrying a string, a parsed response body, or `undefined` printed nothing useful,
naming neither the failure nor the fact that something unexpected came back.

A new `errorMessage` renders any thrown value: an `Error`'s message (or its name when the
message is empty), a thrown string as it is, a `message` field off a thrown object, and
otherwise the object's shape or a labelled primitive. A thrown object is scrubbed first,
since it arrives from a rejected request as often as from our own code.
