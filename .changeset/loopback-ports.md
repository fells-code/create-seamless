---
"seamless-cli": patch
---

Generated compose files now publish every port on `127.0.0.1` instead of all interfaces. A scaffolded
stack was reachable from any machine on the same network, which mattered most for the auth server:
it is configured with `ALLOW_UNCREDENTIALED_DELIVERY_SECRETS=true` so `seamless login --local` can
read OTP codes from the response, and that opt-in is honored before any service-token check. Anyone
on the LAN could request a code for any user of the stack and read it. Postgres was exposed on the
same terms, with the fixed credentials the compose file ships.

Local development is unchanged: the browser, the CLI, and inter-container traffic all still work.
