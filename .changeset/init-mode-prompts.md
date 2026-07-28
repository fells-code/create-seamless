---
"seamless-cli": minor
---

`init` now offers the managed path instead of assuming it. A portal session used to make managed the
default silently, with `--local` as the only escape and no way to learn you needed it until after the
template prompts. When your account has a provisioned application, `init` asks whether to connect it
or scaffold a local stack, with managed leading.

Whether managed is even possible is resolved before the first prompt. An account with nothing to
connect no longer answers two prompts and then fails: it says why and continues to a local scaffold.
That message now distinguishes "no applications yet" from "still provisioning", which the old
`NoApplicationsError` got wrong for anyone mid-provision.

A directory that already has files is no longer forced down the integrate path. `init` asks whether
to connect it to a managed application or scaffold in place, and warns that starter files overwrite
anything with the same name. Scaffolding into a non-empty directory was previously impossible, so a
stray `README` or `.git` was enough to block a local project.

An unreachable control plane asks before scaffolding a local stack rather than degrading silently.

`--local` and `--app <id>` skip the new prompts, and `--app` without a session still fails rather
than falling back.
