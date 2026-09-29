import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./module-boundaries.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

const cwd = "/repo";
const file = (path: string) => `${cwd}/${path}`;

ruleTester.run("module-boundaries", rule, {
  valid: [
    {
      name: "a route may import a module's public entry point",
      filename: file("src/app/(app)/quotes/page.tsx"),
      code: `import { listQuotes } from "@/modules/quotes";`,
      options: [{ root: cwd }],
    },
    {
      name: "a module may reach into its own internals",
      filename: file("src/modules/quotes/application/send-quote.ts"),
      code: `import { transition } from "@/modules/quotes/domain/state-machine";`,
      options: [{ root: cwd }],
    },
    {
      name: "a module may import another module's public entry point",
      filename: file("src/modules/invoices/application/convert.ts"),
      code: `import { getApprovedQuote } from "@/modules/quotes";`,
      options: [{ root: cwd }],
    },
    {
      name: "relative imports inside the same module are fine",
      filename: file("src/modules/quotes/domain/totals.ts"),
      code: `import { status } from "./status";`,
      options: [{ root: cwd }],
    },
    {
      name: "infra may use the database",
      filename: file("src/modules/quotes/infra/quote-repository.ts"),
      code: `import { db } from "@/db";`,
      options: [{ root: cwd }],
    },
    {
      name: "application may use the database for transactions",
      filename: file("src/modules/quotes/application/send-quote.ts"),
      code: `import { db } from "@/db";`,
      options: [{ root: cwd }],
    },
    {
      name: "a module's schema file may use the database helpers",
      filename: file("src/modules/quotes/schema.ts"),
      code: `import { pgTable } from "drizzle-orm/pg-core"; import { timestamps } from "@/db/columns";`,
      options: [{ root: cwd }],
    },
    {
      name: "test files may use the database harness",
      filename: file("src/modules/quotes/application/send-quote.int.test.ts"),
      code: `import { testDb } from "@/db/testing";`,
      options: [{ root: cwd }],
    },
    {
      name: "domain may use shared pure helpers and zod",
      filename: file("src/modules/quotes/domain/totals.ts"),
      code: `import { money } from "@/shared/money"; import { z } from "zod";`,
      options: [{ root: cwd }],
    },
    {
      name: "files outside src are not policed",
      filename: file("scripts/seed.ts"),
      code: `import { db } from "@/db"; import { x } from "@/modules/quotes/infra/repo";`,
      options: [{ root: cwd }],
    },
    {
      name: "windows-style paths are normalised",
      filename: "C:\\repo\\src\\modules\\quotes\\application\\send-quote.ts",
      code: `import { transition } from "@/modules/quotes/domain/state-machine";`,
      options: [{ root: "C:\\repo" }],
    },
  ],
  invalid: [
    {
      name: "a route may not reach into a module's internals",
      filename: file("src/app/(app)/quotes/page.tsx"),
      code: `import { transition } from "@/modules/quotes/domain/state-machine";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "deepImport", data: { module: "quotes" } }],
    },
    {
      name: "a module may not reach into another module's internals",
      filename: file("src/modules/invoices/application/convert.ts"),
      code: `import { quoteRepo } from "@/modules/quotes/infra/quote-repository";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "deepImport", data: { module: "quotes" } }],
    },
    {
      name: "relative paths that escape into another module count too",
      filename: file("src/modules/invoices/application/convert.ts"),
      code: `import { transition } from "../../quotes/domain/state-machine";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "deepImport", data: { module: "quotes" } }],
    },
    {
      name: "re-exports are checked like imports",
      filename: file("src/components/quote-badge.tsx"),
      code: `export { status } from "@/modules/quotes/domain/status";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "deepImport", data: { module: "quotes" } }],
    },
    {
      name: "dynamic imports are checked like imports",
      filename: file("src/app/(app)/quotes/page.tsx"),
      code: `const m = await import("@/modules/quotes/infra/quote-repository");`,
      options: [{ root: cwd }],
      errors: [{ messageId: "deepImport", data: { module: "quotes" } }],
    },
    {
      name: "a page may not touch the database",
      filename: file("src/app/(app)/quotes/page.tsx"),
      code: `import { db } from "@/db";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "dbAccess" }],
    },
    {
      name: "a component may not touch the database",
      filename: file("src/components/customer-list.tsx"),
      code: `import { customers } from "@/db/schema";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "dbAccess" }],
    },
    {
      name: "UI code may not use drizzle directly",
      filename: file("src/components/customer-list.tsx"),
      code: `import { eq } from "drizzle-orm";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "dbAccess" }],
    },
    {
      name: "domain may not import the framework",
      filename: file("src/modules/quotes/domain/state-machine.ts"),
      code: `import { headers } from "next/headers";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "impureDomain", data: { source: "next/headers" } }],
    },
    {
      name: "domain may not import React",
      filename: file("src/modules/quotes/domain/state-machine.ts"),
      code: `import { cache } from "react";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "impureDomain", data: { source: "react" } }],
    },
    {
      name: "domain may not import the database",
      filename: file("src/modules/quotes/domain/state-machine.ts"),
      code: `import { db } from "@/db";`,
      options: [{ root: cwd }],
      errors: [{ messageId: "impureDomain", data: { source: "@/db" } }],
    },
    {
      name: "domain may not import its own module's infra",
      filename: file("src/modules/quotes/domain/state-machine.ts"),
      code: `import { repo } from "../infra/quote-repository";`,
      options: [{ root: cwd }],
      errors: [
        {
          messageId: "impureDomain",
          data: { source: "../infra/quote-repository" },
        },
      ],
    },
  ],
});
