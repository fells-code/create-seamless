---
'seamless-cli': patch
---

Report why an org or membership request failed.

`orgEnvelope` and `membershipEnvelope` collapsed every non-ok response to
`Request failed (409)`, discarding the server's `error` and `details`. The instance
answers with the actionable part, "Organization slug already in use", "User is already an
organization member", "Organization must keep at least one owner", and none of it reached
the developer.

Both now surface the server's reason and validation details, matching how `systemConfig`
already handles them, scrubbed on the way out. They also separate a failed request from a
successful one that carried no organization or membership, which previously produced the
same opaque message.
