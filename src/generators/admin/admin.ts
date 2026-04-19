import path from "path";
import {
  cloneRepo,
  copyEnvExample,
  removeGitDir,
} from "../../utils/repoUtils.js";

const ADMIN_STARTER_REPO =
  "https://github.com/fells-code/seamless-auth-admin-dashboard.git";

export async function generateAdminStarter(context: { root: string }) {
  const { root } = context;
  const adminDir = path.join(root, "admin");

  console.log("Cloning Seamless Auth admin dashboard...");

  await cloneRepo(ADMIN_STARTER_REPO, adminDir);

  removeGitDir(adminDir);
  copyEnvExample(adminDir);

  console.log("Admin dashboard ready.");
}
