---
"seamless-cli": patch
---

Quote generated `.env` values that a dotenv parser would otherwise misread.

`writeEnv` wrote bare `KEY=value`, so a value containing `#`, whitespace, quotes,
a backslash, or a newline (e.g. a managed `API_SERVICE_TOKEN` or a pasted OAuth
secret) produced a `.env` that dotenv truncates or mis-parses. Values that need
it are now double-quoted and escaped, and `parseEnv`/`parseEnvString` unquote on
read so the CLI round-trips its own output. Simple values (tokens, URLs, hex
secrets) are still written bare.

Closes #81.
