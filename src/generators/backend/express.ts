import path from "path";
import {
  cloneRepo,
  removeGitDir,
  copyEnvExample,
} from "../../utils/repoUtils.js";

const API_STARTER_REPO =
  "https://github.com/fells-code/seamless-auth-starter-express.git";

export async function generateExpressStarter(context: { root: string }) {
  const { root } = context;

  const apiDir = path.join(root, "api");

  console.log("Cloning Seamless Auth Express starter...");

  await cloneRepo(API_STARTER_REPO, apiDir);

  removeGitDir(apiDir);
  copyEnvExample(apiDir);

  console.log("API starter ready.");
}
