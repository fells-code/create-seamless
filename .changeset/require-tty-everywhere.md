---
"seamless-cli": minor
---

No command renders a prompt when stdin is not a terminal. `seamless init` got this in 0.11.0; it now
covers every command that prompts (`login`, `profile add`, `users delete`,
`users prepare-device-replacement`, `sessions revoke`, `org members remove`, `config apply`, and
`config oauth-providers remove`). Each one stops naming the flag that answers the question, so a CI
step or a scripted run fails immediately instead of hanging until its job times out.

The confirmations that guard a destructive action now take `--force`, matching what `init` already
means by it:

```bash
seamless users delete <id> --force
seamless sessions revoke --all --force
seamless org members remove <orgId> <userId> --force
seamless config apply config.json --force
```

`--yes` and `-y` are accepted aliases everywhere, so `seamless config oauth-providers remove --yes`
keeps working. `--force` does not override `--dry-run`: `config apply --dry-run --force` still
changes nothing, and cancelling a confirmation still reads as declining rather than as an error.
