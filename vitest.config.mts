import { defineConfig } from "vitest/config";

// `npm test` runs the fast suites (unit + components) and is what the
// pre-commit hook executes. Integration tests (`*.int.test.ts`) need a real
// Postgres and run separately via `npm run test:int` (added in Phase 0.2).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "eslint-rules/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "**/node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
