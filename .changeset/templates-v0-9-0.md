---
"seamless-cli": minor
---

Scaffold from `seamless-templates` `v0.9.0`.

Both React starters move to `@seamless-auth/react` `^0.9.0`, which makes the bundled auth screens
themeable: every colour reads from a `--seamless-*` CSS custom property with the previous literal as
its fallback, so a scaffolded project can match the auth UI to its brand by setting those variables
on `:root` or on any ancestor of `<AuthRoutes />`. The public API is unchanged, and a project that
sets no variables renders exactly as before.

Both API starters now pin `postgres:18-alpine`, with the volume mounted at `/var/lib/postgresql`.
Until this bump a scaffold named two different majors in the same directory — `postgres:18` in the
CLI-generated compose file and `postgres:16-alpine` in the API starter copied in beside it.

Every starter also ships a working test, lint, and format setup out of the box: Vitest with tests
that pass on a fresh `npm install`, Prettier alongside ESLint, and the same script names across all
four (`typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:watch`,
`test:coverage`, and a `check` that runs the whole gate).
