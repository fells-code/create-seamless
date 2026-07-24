---
"seamless-cli": minor
---

Let adopters choose how the admin console is hosted during `seamless init`.

The old "Include Admin Dashboard?" / image-vs-source prompts are replaced by a
single question with four options:

- **Served by your API at /console** (recommended default) — the app backend
  proxies the console via the SDK's `createSeamlessConsoleProxy`, so it loads
  from the API's own origin. The scaffold sets `SERVE_ADMIN_CONSOLE=true` on the
  API, `SERVE_ADMIN_DASHBOARD=true` on the auth server, and adds the API origin
  to the auth server's `ORIGINS` so console passkey ceremonies verify. No
  separate admin container.
- **Separate container** — official image or cloned source, as before, on
  `http://localhost:5174`.
- **None** — no console is scaffolded.

Each choice pre-configures the auth-server env, the app-backend env, the Docker
Compose services, `seamless.config.json`, the success output, and `seamless
check` accordingly. Pins the auth API image to `v0.3.0` and the templates to
`v0.3.0` (which env-gate the console proxy).
