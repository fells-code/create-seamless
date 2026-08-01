---
"seamless-cli": minor
---

Add a non-interactive `seamless init`. `--yes` (`-y`) answers every question with the option the
prompt marks as recommended, so a scaffold runs from CI, a Dockerfile, or a script with no terminal
attached:

```bash
seamless init my-app --local --yes --email=you@example.com
```

Each question also gets its own flag, honored with or without `--yes`: `--web=<id|alias>` and
`--api=<id|alias>` choose the starters, `--email=<address>` sets the owner who becomes the admin,
`--auth=<docker|local>` picks how the auth server runs, and `--admin=<api|image|source|none>` picks
where the admin console is hosted. Unspecified values fall back to the recommended option, except
the owner email, which has no safe default and is taken from `--email` or the portal session.

`--yes` deliberately stops rather than guessing in three places. Choosing between a managed
application and a local stack needs `--app <id>` or `--local`. Scaffolding into a directory that is
not empty needs `--force`, since starter files overwrite anything with the same name. Rotating a
managed application's existing service token needs `--force` too, because it breaks whatever is
already deployed on the old one.
