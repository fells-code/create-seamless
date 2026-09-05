---
'seamless-cli': patch
---

Remove the `useDocker` flag that could only ever be true.

With the Docker confirm gone, `runProjectSetupPrompts` still returned `useDocker: true`
unconditionally and `init` still gated the Docker Compose generation on it. The condition
had no false case, so the guard read like a real choice while describing a scaffold the
CLI never produced.

The field is off the answers object and the compose file is now generated outright on the
local scaffold path. Nothing about what `init` generates changes.
