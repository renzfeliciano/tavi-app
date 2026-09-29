// Enforces the modular-monolith boundaries from docs/foundation-proposal.md §A.3:
//
//   1. Outside `src/modules/<name>/`, a module may only be imported through its
//      public entry point (`@/modules/<name>`), never its internals.
//   2. Only the data layer may touch the database (`@/db`, `drizzle-orm`):
//      `src/db/`, module `application/` and `infra/` folders, module
//      `schema.ts` files and tests.
//   3. Module `domain/` code stays pure: no framework, React, database, or its
//      own module's `application/`/`infra/` layers.
//
// Only files under `src/` are checked.

import path from "node:path";

const toPosix = (p) => p.replaceAll("\\", "/");

const DOMAIN_FORBIDDEN_PACKAGES = [
  "next",
  "react",
  "react-dom",
  "drizzle-orm",
  "server-only",
];

const isPackage = (source, name) =>
  source === name || source.startsWith(`${name}/`);

const isDatabaseImport = (source) =>
  isPackage(source, "@/db") || isPackage(source, "drizzle-orm");

const isTestFile = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);

/** Splits `src/modules/<name>/<rest>` into its parts, or returns null. */
function moduleOf(srcRelative) {
  const match = /^src\/modules\/([^/]+)(?:\/(.*))?$/.exec(srcRelative);
  if (!match) return null;
  return { name: match[1], rest: match[2] ?? "" };
}

/**
 * Resolves an import source to a repo-relative posix path when it points into
 * `src/` (via the `@/` alias or a relative path). Returns null for packages.
 */
function resolveSource(source, importerDir) {
  if (source.startsWith("@/")) return `src/${source.slice(2)}`;
  if (source.startsWith("./") || source.startsWith("../")) {
    return path.posix.normalize(path.posix.join(importerDir, source));
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const moduleBoundaries = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce module public entry points, database access and domain purity.",
    },
    messages: {
      deepImport:
        "Import '{{module}}' through its public entry point '@/modules/{{module}}', not its internals.",
      dbAccess:
        "Only the data layer may access the database. Call a module use case instead.",
      impureDomain:
        "Domain code must stay pure: '{{source}}' is not allowed in a module's domain/ folder.",
    },
    schema: [
      {
        type: "object",
        properties: { root: { type: "string" } },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const root = toPosix(context.options[0]?.root ?? context.cwd);
    const file = toPosix(context.filename);
    const relative = path.posix.relative(root, file);
    if (!relative.startsWith("src/")) return {};

    const importerDir = path.posix.dirname(relative);
    const importerModule = moduleOf(relative);
    const inDomain = importerModule?.rest.startsWith("domain/") ?? false;
    const mayUseDatabase =
      isTestFile(relative) ||
      relative.startsWith("src/db/") ||
      (importerModule !== null &&
        (importerModule.rest === "schema.ts" ||
          importerModule.rest.startsWith("application/") ||
          importerModule.rest.startsWith("infra/")));

    function check(node, source) {
      if (typeof source !== "string") return;
      const target = resolveSource(source, importerDir);
      const targetModule = target ? moduleOf(target) : null;

      if (inDomain) {
        const sameModuleOuterLayer =
          targetModule?.name === importerModule.name &&
          /^(application|infra)(\/|$)/.test(targetModule.rest);
        if (
          DOMAIN_FORBIDDEN_PACKAGES.some((pkg) => isPackage(source, pkg)) ||
          isPackage(source, "@/db") ||
          sameModuleOuterLayer
        ) {
          context.report({ node, messageId: "impureDomain", data: { source } });
          return;
        }
      }

      if (
        targetModule &&
        targetModule.rest !== "" &&
        targetModule.name !== importerModule?.name
      ) {
        context.report({
          node,
          messageId: "deepImport",
          data: { module: targetModule.name },
        });
        return;
      }

      if (!mayUseDatabase && isDatabaseImport(source)) {
        context.report({ node, messageId: "dbAccess" });
      }
    }

    const fromSource = (node) => check(node.source, node.source?.value);

    return {
      ImportDeclaration: fromSource,
      ExportNamedDeclaration: fromSource,
      ExportAllDeclaration: fromSource,
      ImportExpression(node) {
        if (node.source.type === "Literal") check(node, node.source.value);
      },
    };
  },
};

export default moduleBoundaries;
