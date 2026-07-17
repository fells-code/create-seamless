import { describe, expect, it } from "vitest";

// admin.ts is an intentionally empty module: the admin service scaffolding
// currently lives in ../docker/docker.ts (adminService/adminMode), which is
// covered by docker.test.ts. There is no source in this file to exercise, so
// this only guards that the module still loads cleanly with no exports.
describe("generators/admin/admin.ts", () => {
  it("has no exports", async () => {
    const mod = await import("./admin.js");
    expect(Object.keys(mod)).toEqual([]);
  });
});
