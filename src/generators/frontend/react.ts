import path from "path";
import fs from "fs";
import { runCommand } from "../../core/exec.js";
import { TEMPLATE_ROOT } from "../../core/paths.js";
import { select } from "@clack/prompts";

const VITE_VERSION = "7";
const REACT_VERSION = "19";
const ROUTER_VERSION = "7";
const SEAMLESS_VERSION = "latest";

export async function generateReactVite(context: any) {
  const { root, packageManager } = context;

  console.log("Scaffolding Vite project...");

  await runCommand(
    packageManager,
    packageManager === "npm"
      ? ["create", `vite@${VITE_VERSION}`, ".", "--", "--template", "react-ts"]
      : ["create", `vite@${VITE_VERSION}`, ".", "--template", "react-ts"],
    root,
  );

  const routerMode = await select({
    message: "Use built-in SeamlessAuth router + SDK routes?",
    options: [
      { value: "router", label: "Yes (Router Mode)" },
      { value: "simple", label: "No (Custom Auth UI)" },
    ],
  });

  console.log("Installing dependencies...");

  const baseDeps = [
    `react@${REACT_VERSION}`,
    `react-dom@${REACT_VERSION}`,
    `@seamless-auth/react@${SEAMLESS_VERSION}`,
  ];

  if (routerMode === "router") {
    baseDeps.push(`react-router-dom@${ROUTER_VERSION}`);
  }

  await installDeps(packageManager, baseDeps, root);

  console.log("Applying Seamless template...");

  applyTemplate(root, routerMode);

  console.log("React project ready.");
}

function applyTemplate(root: string, mode: string | symbol) {
  const templateDir = path.join(TEMPLATE_ROOT, "frontend/react");

  const indexCss = path.join(root, "src/index.css");
  if (fs.existsSync(indexCss)) {
    fs.unlinkSync(indexCss);
  }

  fs.copyFileSync(
    path.join(templateDir, "App.css.tpl"),
    path.join(root, "src/App.css"),
  );

  const appTemplate = mode === "router" ? "App.router.tsx.tpl" : "App.tsx.tpl";

  fs.copyFileSync(
    path.join(templateDir, appTemplate),
    path.join(root, "src/App.tsx"),
  );

  fs.copyFileSync(
    path.join(templateDir, "main.tsx.tpl"),
    path.join(root, "src/main.tsx"),
  );

  fs.copyFileSync(
    path.join(templateDir, "env.example.tpl"),
    path.join(root, ".env.example"),
  );
}

async function installDeps(pm: string, deps: string[], root: string) {
  if (pm === "npm") {
    await runCommand("npm", ["install", ...deps], root);
  } else if (pm === "pnpm") {
    await runCommand("pnpm", ["add", ...deps], root);
  } else {
    await runCommand("yarn", ["add", ...deps], root);
  }
}
