---
'seamless-cli': patch
---

Say what could not be reached when a scaffold's network read fails.

`seamless init` makes three remote reads: the template registry, the templates archive, and
the auth server's `.env.example`. Each of them handles a non-ok HTTP response with a message
naming the status and the URL, but a connection-level failure (offline, DNS, TLS, no route)
rejects with a bare `TypeError: fetch failed` that propagated untouched to the top-level
handler. The whole output was "Error: fetch failed", which named neither the host nor which
of the three reads had failed.

The three call sites now go through a shared helper that turns that rejection into a message
naming the URL, what the CLI wanted from it, and the network as the likely cause, in the
style `login` already uses for an unreachable instance. Non-ok responses keep the messages
they had, and the original error is preserved as the thrown error's `cause`.
