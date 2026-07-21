---
"seamless-cli": minor
---

Add `seamless login --local` for self-hosted and local instances. It asks the instance to return the email or phone OTP in the response body instead of sending it, then verifies with that code automatically, so logins work without a real mail or SMS provider. It only runs against local hosts and requires the auth API to run outside production with `ALLOW_UNCREDENTIALED_DELIVERY_SECRETS=true`.
