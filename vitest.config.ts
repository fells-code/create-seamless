import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts"],
      // Regression floor, set just below the current numbers (lines/statements
      // ~99.8%, functions ~99.6%, branches ~96.9%). The remaining gap is a
      // small set of unreachable branches; keep new code at or above these.
      thresholds: {
        lines: 99,
        statements: 99,
        functions: 99,
        branches: 95,
      },
    },
  },
});
