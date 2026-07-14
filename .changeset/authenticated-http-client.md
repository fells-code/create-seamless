---
"seamless-cli": minor
---

Add an authenticated HTTP client that targets the active profile's instance,
attaches the Bearer access token, and transparently refreshes on expiry. On a
401 it calls `POST /refresh` with the opaque refresh token, persists the rotated
pair, and retries the original request once. A rotated or reused refresh token
clears the local session and raises a clear re-login prompt instead of a stack
trace. Non-JSON and empty response bodies are parsed defensively, and rate-limit
(429) responses are surfaced without triggering a refresh.
