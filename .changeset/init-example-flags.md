---
"seamless-cli": minor
---

`seamless init --<example>` selects a use-case starter by its registry alias (e.g. `seamless init --oauth`), skipping the web prompt. Aliases are defined in the templates registry, so adding an example needs no CLI change. Unknown flags list the available examples, and the interactive web prompt now presents the available examples.
