import { execCommand } from "./exec.js";

async function fetchStatus(url: string): Promise<void> {
  await execCommand("curl", ["-f", "-L", url], { quiet: true });
}

export async function runPostDeployHealthChecks(urls: {
  web: string;
  api: string;
  auth: string;
  admin: string;
}): Promise<void> {
  await fetchStatus(urls.web);
  await fetchStatus(urls.api);
  await fetchStatus(urls.auth);
  await fetchStatus(urls.admin);
}
