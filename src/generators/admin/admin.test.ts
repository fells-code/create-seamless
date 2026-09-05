import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEAMLESS_AUTH_ADMIN_DASHBOARD_REF } from "../../core/images.js";
import { generateAdminSource } from "./admin.js";

let root: string;

// A stand-in for the GitHub archive: every entry nested under one top-level
// directory, the way `/archive/<ref>.zip` ships it.
function archive(files: Record<string, string>, top = "dashboard-1.0.0"): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(`${top}/${name}`, Buffer.from(content));
  }
  return zip.toBuffer();
}

function servingArchive(buffer: Buffer, status = 200) {
  const fetchMock = vi.fn(async () =>
    status === 200
      ? new Response(new Uint8Array(buffer), { status })
      : new Response("nope", { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const DASHBOARD = {
  Dockerfile: "FROM node:22\n",
  "package.json": '{"name":"admin"}',
  "src/App.tsx": "export default () => null;\n",
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "seamless-admin-"));
  delete process.env.SEAMLESS_ADMIN_DASHBOARD_DIR;
  delete process.env.SEAMLESS_ADMIN_DASHBOARD_REF;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SEAMLESS_ADMIN_DASHBOARD_DIR;
  delete process.env.SEAMLESS_ADMIN_DASHBOARD_REF;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("generateAdminSource", () => {
  it("unpacks the dashboard into admin/, stripping the archive's top directory", async () => {
    servingArchive(archive(DASHBOARD));

    const dir = await generateAdminSource(root);

    expect(dir).toBe(path.join(root, "admin"));
    expect(fs.readFileSync(path.join(dir, "Dockerfile"), "utf-8")).toBe(
      "FROM node:22\n",
    );
    expect(fs.existsSync(path.join(dir, "src/App.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "dashboard-1.0.0"))).toBe(false);
  });

  it("requests the ref the published image is built from", async () => {
    const fetchMock = servingArchive(archive(DASHBOARD));

    await generateAdminSource(root);

    expect(fetchMock).toHaveBeenCalledWith(
      `https://github.com/fells-code/seamless-auth-admin-dashboard/archive/${SEAMLESS_AUTH_ADMIN_DASHBOARD_REF}.zip`,
    );
  });

  it("honours SEAMLESS_ADMIN_DASHBOARD_REF", async () => {
    const fetchMock = servingArchive(archive(DASHBOARD));
    process.env.SEAMLESS_ADMIN_DASHBOARD_REF = "main";

    await generateAdminSource(root);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/fells-code/seamless-auth-admin-dashboard/archive/main.zip",
    );
  });

  it("skips checkout artifacts the archive carries", async () => {
    servingArchive(
      archive({
        ...DASHBOARD,
        ".github/workflows/ci.yml": "on: push\n",
        "node_modules/left-pad/index.js": "module.exports = 1;",
      }),
    );

    const dir = await generateAdminSource(root);

    expect(fs.existsSync(path.join(dir, ".github"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "node_modules"))).toBe(false);
  });

  it("copies from a local checkout when SEAMLESS_ADMIN_DASHBOARD_DIR is set", async () => {
    const fetchMock = servingArchive(archive(DASHBOARD));
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-src-"));
    fs.writeFileSync(path.join(checkout, "Dockerfile"), "FROM local\n");
    fs.mkdirSync(path.join(checkout, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(checkout, "node_modules", "x.js"), "");
    process.env.SEAMLESS_ADMIN_DASHBOARD_DIR = checkout;

    const dir = await generateAdminSource(root);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(dir, "Dockerfile"), "utf-8")).toBe("FROM local\n");
    expect(fs.existsSync(path.join(dir, "node_modules"))).toBe(false);
    fs.rmSync(checkout, { recursive: true, force: true });
  });

  it("reports a failed download with its status and URL", async () => {
    servingArchive(Buffer.from(""), 404);

    await expect(generateAdminSource(root)).rejects.toThrow(
      /Failed to download the admin dashboard \(404\)/,
    );
  });

  it("rejects an empty archive", async () => {
    servingArchive(new AdmZip().toBuffer());

    await expect(generateAdminSource(root)).rejects.toThrow(/archive was empty/);
  });

  // `build: ./admin` in the generated compose file needs a Dockerfile there. Failing
  // during init names the problem; failing at `docker compose up` does not.
  it("fails when the unpacked dashboard has no Dockerfile", async () => {
    servingArchive(archive({ "package.json": "{}" }));

    await expect(generateAdminSource(root)).rejects.toThrow(
      /has no Dockerfile.*--admin=image/s,
    );
  });
});
