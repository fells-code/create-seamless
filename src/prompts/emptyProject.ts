import { select, confirm } from "@clack/prompts";
import { generateReactVite } from "../generators/frontend/react.js";

export async function handleEmptyProject(context: any) {
  const shouldCreate = await confirm({
    message: "No project detected. Start a new project here?",
  });

  if (!shouldCreate) return;

  const projectType = await select({
    message: "What would you like to create?",
    options: [
      { value: "react-vite", label: "React (Vite)" },
      { value: "backend", label: "Backend API (coming soon)" },
      { value: "auth", label: "Seamless Auth Server (coming soon)" },
    ],
  });

  if (projectType === "react-vite") {
    await generateReactVite(context);
  }
}
