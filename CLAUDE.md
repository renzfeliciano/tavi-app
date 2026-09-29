@AGENTS.md

# TAVI

Quoting and invoicing SaaS for small service businesses: **Customer → Quote → Approval → Invoice → Payment**. Philippines first. No AI in the shipped product.

**Source of truth:** `docs/foundation-proposal.md`. It holds the architecture, domain rules, the founder's decision log (D1–D9) and the roadmap. Read the relevant section before starting any feature, and update it when a decision changes.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3200 |
| `npm run lint` | ESLint, zero warnings allowed (includes `tavi/module-boundaries`) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Fast unit + component tests (Vitest). The pre-commit hook runs lint, typecheck and this. |
| `npm run test:e2e` | Playwright on desktop + mobile, including axe accessibility checks |
| `npm run build` | Production build |

## Rules

- **Next.js 16 is newer than your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code (for example, `proxy.ts` replaces `middleware.ts`, and request APIs are async).
- **Test-first for domain logic.** Write the failing test, confirm it fails for the right reason, then implement. Any change to tested code updates its tests.
- **Module boundaries are lint-enforced** (`eslint-rules/module-boundaries.mjs`):
  - import a module only through `@/modules/<name>`;
  - only `src/db/`, module `application/` and `infra/` folders, module `schema.ts` files and tests may touch the database;
  - `domain/` stays pure.
- **Tenant data:** never trust an organization ID from the client. It always comes from the server-side session context.
- **Money:** integer minor units plus a currency code. Never use floats. All totals come from the one calculation function (§B.2).
- **UI:** use semantic tokens from `src/app/globals.css`, never raw colours. Primitives live in `src/components/ui` (shadcn on Base UI); check with `npx shadcn@latest docs <component>` rather than writing from memory.
- **Secrets:** never paste or log connection strings or keys. `.env.local` is gitignored, and `.env.example` documents every variable.
- **Brand:** read product names and taglines from `src/config/brand.ts`. "TAVI" is the wordmark; "Tavi" is used in running text.
