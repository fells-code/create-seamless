import { inspectProject } from "../core/inspect.js";
import { handleEmptyProject } from "../prompts/emptyProject.js";
//import { handleExistingProject } from "../prompts/existingProject.js";

export async function initCommand() {
  const context = await inspectProject(process.cwd());

  if (!context.detected.anything) {
    await handleEmptyProject(context);
    return;
  }

  //await handleExistingProject(context);
}
