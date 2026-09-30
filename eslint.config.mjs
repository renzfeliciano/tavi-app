import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import moduleBoundaries from "./eslint-rules/module-boundaries.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { tavi: { rules: { "module-boundaries": moduleBoundaries } } },
    rules: {
      // docs/foundation-proposal.md §A.3 — module public entry points, DB access, pure domain.
      "tavi/module-boundaries": "error",
      // §I — React escaping only; user-provided text is never rendered as HTML.
      "react/no-danger": "error",
    },
  },
  {
    // §I: Drizzle parameterizes every query; `sql.raw` bypasses that, so it is
    // only allowed in the data layer's own plumbing (src/db).
    ignores: ["src/db/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "sql",
          property: "raw",
          message: "sql.raw skips parameterization. Use the sql`` template (or move the code into src/db).",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
