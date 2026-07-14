---
"seamless-cli": minor
---

Add `seamless login`, an interactive email OTP login for the active profile's
Seamless Auth instance. It calls `POST /login` (honoring the instance's returned
`loginMethods`), triggers the code with `GET /otp/generate-login-email-otp`,
prompts for the code you paste from your inbox, and verifies it with `POST
/otp/verify-login-email-otp`. On success it stores the session in the OS keychain
and records the identity (sub, email, identifier type) on the profile. The
command caps local code retries so it does not trip the per-IP OTP limiter,
surfaces a 429 clearly, refreshes the code automatically if the 5 minute
ephemeral window lapses, and reports unreachable instances without a stack trace.
Accepts the identifier positionally or with `--identifier`, and targets a
specific profile with `--profile`.
