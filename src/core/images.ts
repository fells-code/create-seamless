export const POSTGRES_IMAGE = "postgres:17";

export const SEAMLESS_AUTH_API_VERSION = "v0.4.0";

export const SEAMLESS_AUTH_API_IMAGE = `ghcr.io/fells-code/seamless-auth-api:${SEAMLESS_AUTH_API_VERSION}`;

export const SEAMLESS_AUTH_ADMIN_DASHBOARD_VERSION = "v0.3.0";

export const SEAMLESS_AUTH_ADMIN_DASHBOARD_IMAGE = `ghcr.io/fells-code/seamless-auth-admin-dashboard:${SEAMLESS_AUTH_ADMIN_DASHBOARD_VERSION}`;

// The starter templates monorepo the CLI scaffolds from. Pinned to a tag so a given
// CLI version always produces the same project. Override the ref with
// SEAMLESS_TEMPLATES_REF, or point at a local checkout with SEAMLESS_TEMPLATES_DIR.
export const SEAMLESS_TEMPLATES_REPO = "fells-code/seamless-templates";

export const SEAMLESS_TEMPLATES_REF = "v0.4.0";
