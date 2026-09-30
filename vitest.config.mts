import { defineConfig } from "vitest/config";

// `npm test` runs the fast suites (unit + components) and is what the
// pre-commit hook executes. Integration tests (`*.int.test.ts`) need a real
// Postgres (the Neon `test` branch, or CI's service container) and run
// separately via `npm run test:int`.
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
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["./src/db/testing/global-setup.ts"],
          // One file at a time: they share (and reset) one real database.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
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
