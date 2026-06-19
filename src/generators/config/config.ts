import fs from "fs";
import path from "path";
import { VERSION } from "../../index.js";
import {
  SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE,
  SEAMLESS_AUTH_API_IMAGE,
} from "../../core/images.js";

export function generateSeamlessConfig(
  root: string,
  options: {
    projectName?: string;
    webFramework: string;
    apiFramework: string;
    authMode: "local" | "docker";
    adminMode: "image" | "source";
  },
) {
  const config = {
    version: VERSION,
    projectName: options.projectName || path.basename(root),
    createdAt: new Date().toISOString(),

    services: {
      web: {
        framework: options.webFramework,
        path: "./web",
      },
      api: {
        framework: options.apiFramework,
        path: "./api",
      },
      auth: {
        mode: options.authMode,
        image: options.authMode === "docker" ? SEAMLESS_AUTH_API_IMAGE : null,
        path: options.authMode === "local" ? "./auth" : null,
      },
      admin: {
        mode: options.adminMode,
        image:
          options.adminMode === "image"
            ? SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE
            : null,
        path: options.adminMode === "source" ? "./admin" : null,
      },
      database: {
        type: "postgres",
      },
    },

    docker: {
      composeFile: "docker-compose.yml",
    },
  };

  fs.writeFileSync(
    path.join(root, "seamless.config.json"),
    JSON.stringify(config, null, 2),
  );

  console.log("Seamless config created.");
}
