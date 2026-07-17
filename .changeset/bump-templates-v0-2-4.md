---
"seamless-cli": patch
---

chore(templates): scaffold from seamless-templates v0.2.4

Bump `SEAMLESS_TEMPLATES_REF` to `v0.2.4`. The Express template now has a working production `npm run start` (fixed extensionless ESM imports and the migration runner path) and ships the `docker-compose.yml` its scripts and README referenced. The web templates (react-vite and react-oauth) drop the unused `VITE_AUTH_SERVER_URL`, and all templates document both the local and managed init paths.
