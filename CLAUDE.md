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
| `npm run test:int` | Integration tests against real Postgres (Neon `test` branch; **wipes it**, and refuses to run against `DATABASE_URL`) |
| `npm run db:generate` | Generate a SQL migration from schema changes (review it, then commit it) |
| `npm run db:migrate` | Apply migrations to the `DATABASE_URL_DIRECT` database |
| `npm run db:studio` | Browse the data (Drizzle Studio) |
| `npm run build` | Production build |

## Rules

- **Next.js 16 is newer than your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code (for example, `proxy.ts` replaces `middleware.ts`, and request APIs are async).
- **Test-first for domain logic.** Write the failing test, confirm it fails for the right reason, then implement. Any change to tested code updates its tests.
- **Module boundaries are lint-enforced** (`eslint-rules/module-boundaries.mjs`):
  - import a module only through `@/modules/<name>`;
  - only `src/db/`, module `application/` and `infra/` folders, module `schema.ts` files and tests may touch the database;
  - `domain/` stays pure.
- **Tenant data:** never trust an organization ID from the client. Every signed-in page and server action starts with `requireOrgContext()` from `@/modules/identity` (the app layout calls it too, but actions must call it themselves), then checks permissions with `assertCan(ctx, "…")` from `@/modules/authz`. Never branch on role names. `proxy.ts` is only an optimistic cookie check.
- **Auth forms** (sign-in, sign-up, password reset, resend verification) use `authClient` from `@/lib/auth-client`, so Better Auth's rate limits apply. Map errors with `authErrorMessage` from `@/modules/identity/client`, the module's browser-safe entry point (`@/modules/<name>/client`).
- **Database:** Drizzle over node-postgres. Each module owns its tables in `schema.ts` (listed in `src/db/schema.ts`). App code uses `getDb()` from `@/db`; tests use `@/db/testing`. `sql.raw` is lint-banned outside `src/db`. Document numbers come only from `allocateDocumentNumber` inside the issuing transaction.
- **Money:** integer minor units plus a currency code. Never use floats. All totals come from the one calculation function (§B.2).
- **UI:** follow `DESIGN.md` ("Carbon Copy": one stamp-violet accent used only where ink would go, status = icon + label, money tabular and never animated). Use semantic tokens from `src/app/globals.css`, never raw colours. `/dev/design` (development only) shows every token and component rendered. Primitives live in `src/components/ui` (shadcn on Base UI); check with `npx shadcn@latest docs <component>` rather than writing from memory.
- **Secrets:** never paste or log connection strings or keys. `.env.local` is gitignored, and `.env.example` documents every variable.
- **Brand:** read product names and taglines from `src/config/brand.ts`. "TAVI" is the wordmark; "Tavi" is used in running text.
