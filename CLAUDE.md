@AGENTS.md

# TAVI

Quoting and invoicing SaaS for small service businesses: **Customer → Quote → Approval → Invoice → Payment**. Philippines first. No AI in the shipped product.

**Source of truth:** `docs/foundation-proposal.md`. It holds the architecture, domain rules, the founder's decision log (D1–D17) and the roadmap. Read the relevant section before starting any feature, and update it when a decision changes.

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
- **Philippine invoicing (D13, proposal §B.7):** documents follow BIR RR 7-2024. Every document shows the seller's registered name, the registration statement before the TIN (`taxIdStatement`: "VAT Reg TIN …") and the registered address. Quotations, billing statements and payment acknowledgements print the market's `supplementaryDocumentNotice` in bold. A bill is titled "Invoice" only when the business has entered its BIR system registration (AC/PTU number, date, approved series); otherwise it's a billing statement. Before changing any document, check §B.7's table; state regulation references in comments (e.g. "RR 7-2024 Sec. 6 B.15").
- **Feedback standard:** every action a person takes gets visible feedback. Success and failure show a toast (`toast.success` / `toast.error` from `sonner`, saying what happened: "Juan Dela Cruz archived.", "Couldn't save. …"). Anything destructive, hard to undo, or affecting several things at once asks first in a dialog (delete draft, sign out all other devices, and later void, cancel, record payment). Reversible actions skip the dialog and offer Undo in the toast. Background autosave is the one quiet case: an inline "Saving… / Saved" status, plus a toast only when saving fails. Field problems show inline next to the field; a form-level problem uses `FormAlert`. Moving to another page that shows the result counts as feedback.
- **Audit and email:** every important action calls `recordAuditEvent(tx, …)` from `@/modules/audit` **inside the same transaction** as the change (the table is append-only, enforced by a trigger). Business emails go through `enqueueEmail(tx, …)` and then `flushOutboxAfterResponse()` from `@/modules/notifications`; never send them inline. Add new actions to `AUDIT_ACTIONS`.
- **Logging:** use `logger` from `@/shared/logger` (never `console`). It redacts sensitive keys and scrubs credentials, but don't log request bodies, headers or URLs with query strings anyway.
- **Security headers:** the CSP nonce is per request (`src/proxy.ts`), so every page renders dynamically. Never add `dangerouslySetInnerHTML`, inline `<script>`, or third-party scripts without updating `src/shared/security/headers.ts` and its tests.
- **Secrets:** never paste or log connection strings or keys. `.env.local` is gitignored, and `.env.example` documents every variable.
- **Privacy and terms (D15):** `/terms` and `/privacy` read the operator and the documents' version from `src/config/legal.ts`. When you add personal data, a table holding it, a service provider or a tracking cookie, update the Privacy Notice and `docs/compliance/processing-register.md` in the same change. Bump `LEGAL.version` only for a material change to either document: sign-up records the new version and everyone else is sent to `/accept-terms` once. New tenant tables must be added to the `privacy` module's export (D16), and anything that acts on businesses in bulk must skip closed ones (`organizations.closed_at`).
- **Brand:** read product names and taglines from `src/config/brand.ts`. "TAVI" is the wordmark; "Tavi" is used in running text.
- **No hardcoding (D12):** nothing country-specific appears in code or copy. Currency, locale, time zone, tax suggestions (e.g. VAT 12%), tax-ID name and format, address labels, payment methods, share channels and document names come from the business's market profile (`src/config/markets.ts`, `ctx.market` on `OrgContext`; add a country by adding an entry). Format with the business's `ctx.locale` / `ctx.timezone`, never a literal. Limits, lifetimes and accepted formats are named constants (`BUSINESS_PROFILE_LIMITS`, `TAX_RATE_LIMITS`, `NUMBERING_LIMITS`, `PASSWORD_POLICY`, `LINK_LIFETIMES`, `SESSION_POLICY`, `UPLOAD_MESSAGES`) that the rule, the form `maxLength` and the message all read; browser code imports them from `@/modules/<name>/client`. Build messages from the limit (`tooLong(max)`, `describeDuration(seconds)`). Database columns have no market defaults.

## Project skills

Load the matching skill before working in its area (`.claude/skills/tavi-*`):
`tavi-architecture` (where code goes, use-case pattern) · `tavi-database` (schema, migrations, locking, test DB) · `tavi-financial-domain` (money, tax, statuses, numbering, payments) · `tavi-auth-security` (sessions, authz, tenancy, threat model) · `tavi-ui-ux` (screen contract, forms, copy, mobile) · `tavi-design-system` (tokens, components) · `tavi-motion-design` · `tavi-brand-experience` (voice, mascot) · `tavi-accessibility` · `tavi-testing` (TDD, commands, patterns) · `tavi-code-review` (Definition of Done, commits) · `tavi-ops` (env, deploy, crons, logs) · `tavi-product` (MVP gate, funnel, not-yet list).
