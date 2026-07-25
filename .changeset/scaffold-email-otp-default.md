---
"seamless-cli": minor
---

Enable `email_otp` in the scaffolded auth server's default login methods.

The auth server's own default (`passkey,magic_link`) has no method the CLI can
drive without a browser authenticator, so `seamless login` could not sign in to
a freshly scaffolded local stack. `buildAuthEnv` now appends `email_otp` to
`LOGIN_METHODS` (composing with the OAuth method when providers are configured),
so email-OTP login works out of the box.
