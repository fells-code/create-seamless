import { describe, expect, it } from "vitest";
import {
  POSTGRES_IMAGE,
  SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE,
  SEAMLESS_AUTH_ADMIN_DASHBOARD_VERSION,
  SEAMLESS_AUTH_API_IMAGE,
  SEAMLESS_AUTH_API_VERSION,
  SEAMLESS_TEMPLATES_REF,
  SEAMLESS_TEMPLATES_REPO,
} from "./images.js";

describe("image and version constants", () => {
  it("pins the postgres image", () => {
    expect(POSTGRES_IMAGE).toBe("postgres:18");
  });

  it("builds the auth API image tag from its version", () => {
    expect(SEAMLESS_AUTH_API_IMAGE).toBe(
      `ghcr.io/fells-code/seamless-auth-api:${SEAMLESS_AUTH_API_VERSION}`,
    );
  });

  it("builds the admin dashboard image tag from its version", () => {
    expect(SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE).toBe(
      `ghcr.io/fells-code/seamless-auth-admin-dashboard:${SEAMLESS_AUTH_ADMIN_DASHBOARD_VERSION}`,
    );
  });

  it("defines the templates monorepo location", () => {
    expect(SEAMLESS_TEMPLATES_REPO).toBe("fells-code/seamless-templates");
    expect(SEAMLESS_TEMPLATES_REF).toBeTruthy();
  });
});
