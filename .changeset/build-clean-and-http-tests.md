---
'seamless-cli': patch
---

Clean `dist` before building, so a stale artifact cannot be packed.

`build` was a bare `tsc`, which overwrites but never removes. A file deleted or renamed
in `src` left its old output behind, and `prepublishOnly` runs the same script, so a local
publish could ship something no longer in the source tree. The `clean` script already
existed and is now wired in.
