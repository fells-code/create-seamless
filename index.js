#!/usr/bin/env node
import { execSync } from "child_process";
import path from "path";

const project = process.argv[2] || "seamlessauth-app";

console.log(`🚀 Creating project: ${project}...\n`);

execSync(`npx degit seamlessauth/nextjs-starter ${project}`, {
  stdio: "inherit",
});

console.log(`
✅ Done! 
→ cd ${project}
→ npm install
→ npm run dev
`);
