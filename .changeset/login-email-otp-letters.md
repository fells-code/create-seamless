---
"seamless-cli": patch
---

Fix `seamless login` rejecting valid email OTP codes. Email OTPs are six letters, but the code prompt only accepted digits, so no real email code could be entered. The prompt is now channel-aware: it accepts a six-letter code (case-insensitive, normalized to uppercase) for email logins and a numeric code for phone logins, with matching placeholder text.
