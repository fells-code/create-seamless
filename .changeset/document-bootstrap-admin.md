---
"seamless-cli": patch
---

Document `bootstrap-admin` in the README: add a "Creating the first admin"
section covering the command, its profile-based instance targeting (with the
`SEAMLESS_API_URL` override and `http://localhost:3000` fallback), and the
bootstrap-secret authentication it uses because it runs before any admin exists.
