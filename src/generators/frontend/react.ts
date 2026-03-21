import path from "path";
import {
  cloneRepo,
  removeGitDir,
  copyEnvExample,
} from "../../utils/repoUtils.js";

const WEB_STARTER_REPO =
  "https://github.com/fells-code/seamless-auth-starter-react.git";

export async function generateReactStarter(context: { root: string }) {
  const { root } = context;
  const webDir = path.join(root, "web");

  console.log("Cloning Seamless Auth React starter...");

  await cloneRepo(WEB_STARTER_REPO, webDir);

  removeGitDir(webDir);
  copyEnvExample(webDir);

  console.log("Web starter ready.");
}
