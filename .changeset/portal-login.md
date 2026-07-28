---
"seamless-cli": minor
---

`seamless login` now signs in to the Seamless portal instead of the active profile's instance, and
no longer needs a profile to exist first. The portal session is stored beside the profile map in
`config.json` and is the only session `init` uses to connect a managed application, so a session
for a local or self-hosted instance no longer sends its token to the control plane.

Instance login moves to `seamless profile login [name]`, which signs in without changing the active
profile. `seamless login --profile <name>` keeps working for one more minor version and prints a
pointer to the new command. `whoami` and `logout` default to the portal session and take
`--profile <name>` to target an instance.

Set `SEAMLESS_PORTAL_AUTH_URL` to point the portal login at a different auth host.
