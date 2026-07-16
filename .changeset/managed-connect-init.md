---
"seamless-cli": minor
---

feat(init): connect scaffolds to a managed instance when a profile is logged in

`seamless init` now defaults to the managed control plane whenever a profile has an active session. It reads the logged-in session, lists your applications, issues the application's service token from the control plane (rather than generating a local secret), and points the scaffolded web and api at the managed auth instance. Running `init` inside an existing project wires the managed credentials into `api/.env` in place, or prints them when there is no api directory. The self-hosted flow stays available with `seamless init --local`, and is still used automatically when no session is present. Set `SEAMLESS_PORTAL_API_URL` to override the control-plane host.
