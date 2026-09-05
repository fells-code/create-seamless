---
'seamless-cli': patch
---

Point a managed scaffold at the instance URL the portal computes.

`init` composed the scaffolded backend's `AUTH_SERVER_URL` from `application.domain`, a
stored column the portal superseded. It goes stale when a trial is upgraded and its tenant
moves zones, and mvp and business instances are served at `domain/<infraId>` rather than at
`domain`. Either way the scaffold pointed at a URL that does not answer, and the failure
surfaced as an SDK error in the developer's app rather than as anything the CLI said.

`resolveAppInstanceUrl` already existed for exactly this, and `apps` and the application
picker already used it; the two scaffold paths did not. They do now.

The connectable-application filter asked for `domain` too, so an application the portal
computed an `instanceUrl` for but whose `domain` column was never populated was filtered
out and never offered. It now asks the same question the scaffold does.
