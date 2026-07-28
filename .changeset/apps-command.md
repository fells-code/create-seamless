---
"seamless-cli": minor
---

Add `seamless apps`, so a portal account can see what it owns without opening the dashboard.
`apps list` prints name, plan, status, and instance URL; `apps get <id>` adds the console URL,
region, owners, trial expiry, and whether a service token has been issued (masked, never the live
value). Both take `--json` and both require a portal session.

Applications are now read through the portal's `instanceUrl`, which is derived from the service
plan, rather than the stored `domain` column that goes stale when a trial is upgraded. Applications
that have not finished provisioning are listed instead of being silently dropped. `init` is
unchanged: it still reads `domain` and still considers only applications that have one.
