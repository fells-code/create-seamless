---
"seamless-cli": patch
---

Correct the documentation that had drifted from the rest of the ecosystem.

- `seamless check` and `seamless verify` now have README sections. Verify is half of
  what the CLI does and had none.
- The auth server's local-development steps named a script that does not exist
  (`db:migrate`); the auth API spells it `migrate:up`, and the Docker path runs it for
  you at container start.
- `init --profile` was documented as selecting a profile. It has been accepted and
  ignored since managed connect moved to the portal session, so the help now says so.
- The generated project layout listed a `README.md` the CLI does not write, and omitted
  `seamless.config.json`, `admin/`, and which pieces a managed project skips.
- "No redirects or third-party auth providers" predated OAuth sign-in, which the CLI has
  configured since the provider prompts shipped.
- The included-projects list now names all four repositories the CLI scaffolds from and
  conformance-tests against, including `seamless-auth-server` and `seamless-auth-react`.
- `config set` help was missing `session_idle_ttl` from the string-typed keys.
