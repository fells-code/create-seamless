---
'seamless-cli': patch
---

Redact secrets in the server validation details the CLI prints.

`patchSystemConfig` and the OAuth provider mutations splice a rejected request's `details`
payload into the error they throw, and `runConfig` prints it to stderr. Validation errors
commonly quote the offending value back, and for `seamless config oauth-providers
add|update` that request body carries a `clientSecret`, so a rejected provider config could
print a client secret, in CI, into a build log. Both sites now scrub before stringifying.

The scrubber itself grew to match. It covers `secret`, `clientSecret`, `client_secret`,
`password`, `apiKey`, `api_key`, `otp`, and `code` alongside the token keys it already knew,
and it now masks by shape as well as by key: a JWT or a `Bearer ...` credential quoted
inside a message string is caught wherever it appears, including in a bare string body,
which key matching alone could never reach.

`redactToken` and `scrubTokens` moved from `core/keychain.ts` to a new `core/redact.ts`.
They are a logging concern with no keychain dependency. `--json` output is deliberately
left unscrubbed: it is a machine-readable contract, and rewriting values there would break
scripts and hide data the caller asked for.
