#!/usr/bin/env node
import { execSync } from "child_process";

const project = process.argv[2] || "demo-app";

console.log(`🚀 Creating project: ${project}...\n`);

// Step 1: Clone the starter template
execSync(`npx degit seamless-auth-starter-react ${project}`, {
  stdio: "inherit",
});

// Step 2: Generate HTTPS certs for Vite
console.log(`\n🔒 Generating HTTPS certificates...\n`);
const certDir = path.join(process.cwd(), project, ".cert");
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir);
}
const pems = selfsigned.generate(null, { days: 365 });
fs.writeFileSync(path.join(certDir, "cert.pem"), pems.cert);
fs.writeFileSync(path.join(certDir, "key.pem"), pems.private);

console.log(`
✅ Done! 
→ cd ${project}
→ npm install
→ npm run dev

💡 Note: The browser may ask you to trust the certificate the first time.
`);
