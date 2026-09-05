---
'seamless-cli': patch
---

Stop asking a question whose answer was never used.

Choosing to run the auth server from local source prompted "Auth server still requires
Docker for full stack. Enable Docker?", then discarded the answer: `useDocker` was returned
as `true` either way, and declining only printed "Enabling automatically". The full stack
needs Docker regardless, so the prompt cost a keystroke to tell the developer their answer
did not count.

The prompt is gone, and with it the entire non-docker branch of the success output, which
described a workflow (bring your own PostgreSQL, `npm run dev` per service) that no run
could ever reach. Nothing about what `init` generates changes.
