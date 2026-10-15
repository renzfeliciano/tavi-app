# Tavi: pending work handoff

Prepared 14 Oct 2026 for Travis Renz. Everything below was checked against the repo on that date (`main`, last commit `c0a14e2`). Use it either by reading it yourself or by pasting the starter prompt into a new session.

## Starter prompt (copy this)

```text
You are continuing work on Tavi (Next 16.4, React 19, Tailwind v4, Base UI, Drizzle, Better Auth, Postgres/Neon, Vercel).
Repo: C:\Users\Renzo Payod\Personal Files\tavi-app, branch main.

First read, in this order: CLAUDE.md / AGENTS.md, PRODUCT.md, DESIGN.md, then the handoff file I will point you to (the "Pending work" section).
Then do only the item I name. Do not start the next item when you finish.

Rules that always apply:
- Tests first, and watch them fail (red) before writing the code. No production code without a failing test.
- Keep a visible task list. Decide and state your interpretation of an ambiguous request instead of asking again.
- Stay inside the Carbon Copy design (violet is only ever ink; no entrance animations, count-ups or gradients). No AI slop. Make it a real product.
- A loading skeleton must match the page layout it stands in for.
- Never handle secrets or credentials. Never run scanners against anyone else's site.
- Run the full lint, typecheck, unit/component, integration and e2e suites before any commit or delivery.
- Do not change branch. Do not commit or push unless I ask. Commit messages carry no co-author or session trailers.

Item to do now: <NAME ONE ITEM FROM "Pending work">
```

## Where things stand

- Phases 0, 1 and 2a to 2e are done, committed and pushed: shared list tables, dashboard, Quotations / Billing statements / Payments summary strips, Customers (list and record page), the side panel on quotation and billing statement pages, and the "Last used" column on Products & Services.
- Last measured baseline (14 Oct, after the review fixes): typecheck clean; lint 0 errors; 1,954 unit and component tests; 406 integration tests (47 files); 196 e2e tests passed, 36 skipped by design (account-creating specs run on desktop only). Re-measure before relying on these numbers.
- Withholding certificates (BIR 2307) are partly built: tasks 1 to 4 are in the code (see below).
- The landing page is built and committed (`9039309`); only its documentation and a final verification are open.

## Working rules and conventions

How the code is organised (enforced by `eslint-rules/module-boundaries.mjs`):

- Other modules are imported only through `@/modules/<name>` (server) or `@/modules/<name>/client` (pure code for client components).
- Only application, infra, schema and test files touch Drizzle. Domain code stays pure.
- Pages import queries from module indexes. Permissions go through `assertCan`; all three roles (owner, admin, member) can read catalog, quotes and invoices.

Dates and money:

- "Today" is always the business's own time zone: `todayIn(timezone)`, `daysBetween`, `formatCalendarDate`. Never use UTC. This also applies to e2e tests (a UTC date helper made a test fail between 4 pm and midnight UTC; fixed in `e2e/document-panel.spec.ts`).
- Money is integer minor units. Never add amounts across currencies. Wording comes from the market profile (`market.documents.quote|invoice|receipt`), for example "Billing statement".

Shared UI to reuse rather than rebuild: `DataTable` / `DataTableSkeleton`, `SummaryStrip`, `CellTitle`, `Monogram`, `StatusBadge`, `PAGE_HEADER` and `PageHeaderSkeleton`, `DocumentSidePanel`, `recentDay`. A status badge is 1.5rem tall, so its stand-in is `StatusBadgeSkeleton`; the smaller settings tag uses `BadgeSkeleton` (1.25rem).

Every page has a `loading.tsx` drawn in that page's layout (`src/app/loading-states.test.tsx` fails otherwise). New typed routes are cast `as Route`; every sub-page has a visible Back button; WCAG AA in light and dark; no horizontal scroll on a phone.

Commits: the pre-commit hook runs lint, typecheck and `npm test`. `package.json` scripts: `lint`, `typecheck`, `test`, `test:int`, `test:e2e`.

## Pending work

Pick one item per session, in roughly this order of value.

### 1. Withholding certificates (BIR 2307), tasks 5 to 12

Documents: spec `docs/superpowers/specs/2026-10-13-withholding-certificates-design.md`, plan `docs/superpowers/plans/2026-10-13-withholding-certificates.md`. Read the spec first; the plan's section numbers refer to it.

Goal: a business records the 2307 certificates its customers send, links them to the payments they cover, sees which withholding is still pending, and reports creditable tax by quarter and payor with CSV.

Done and committed (found in the repo; the integration tests for these ran green on 14 Oct):

- Task 1, pure rules: `src/modules/payments/domain/withholding.ts` and its tests.
- Task 2, schema: migration `0030_withholding_certificates.sql` (tables for certificates, lines and payment links), the `withholding_certificate` file purpose, the four audit actions, and the ATC suggestions in the market profile.
- Task 3, scan storage: `src/modules/files/application/withholding-scans.ts`.
- Task 4, use cases: `recordCertificate`, `updateCertificate`, `voidCertificate` in `src/modules/payments/application/certificates.ts`, plus the unlink when a linked payment is voided.

The plan's checkboxes are all still unticked, including the four above; tick them first so the plan is a true record.

Still to build:

| Task | What | Where it lives |
| --- | --- | --- |
| 5 | Queries: `listCertificates`, `getCertificate`, `listPendingByCustomer`, `pendingPaymentsForCustomer`, `paymentWithholdingStatus`, `withholdingForPayments`; `listPayments` accepts `withholding: "pending"` | `certificate-queries.ts` (new) |
| 6 | Quarterly report and CSV (spreadsheet-formula-safe) | `withholding-report.ts` (new) |
| 7 | Badges on existing payment views and the "pending" filter | existing payments pages |
| 8 | Withholding list page | `/payments/withholding` |
| 9 | Record and edit a 2307: form and server actions | `/payments/withholding/...` |
| 10 | Certificate page and void | `/payments/withholding/[id]` |
| 11 | Reports section | `/reports` |
| 12 | E2E, accessibility, docs, full verification, final review | `e2e/`, `DESIGN.md` |

Five cases the plan calls out as likely to bite (each needs a test): a linked payment that is voided loses its link and the certificate shows "Differs by"; two admins linking the same payment at once give exactly one success and one `paymentIds` error, never a 500; quarter edges (Q4 ends 31 Dec, Q1 starts 1 Jan, payments on the first or last day link, a day outside does not); money edges (half-centavo rounds up, tax above income is rejected, `₱1,200.50` parses, blank months count as zero); a TIN with spaces, dashes or letters is rejected or cleaned, and a payor name starting with `=`, `+`, `-` or `@` is neutralised in the CSV.

Two warnings before you start:

- The plan was written before the current workflow. Ignore its "do not commit", "Linux copy" and "the user runs integration on Windows" lines; follow the rules and the "How to run things" section below instead.
- Migration `0030` is already in `main`, and the `vercel-build` script runs `scripts/migrate-on-deploy.mjs` before building. A deploy of `main` therefore appears to apply pending migrations (0030, 0031, 0032) to production. Read that script to confirm, and check production has what you expect before building on top of it.

Use made-up data only (no real TINs, names or addresses) in tests, fixtures and docs.

### 2. Phase 2: the four pages still to upgrade

Each earlier page followed the same loop: read the page and decide the extras worth adding, write failing tests first, build, add a bullet to `DESIGN.md`, write an e2e that measures the loading skeleton against the loaded page, then run everything.

- Reports (`src/app/(app)/reports`): an aging bar for receivables.
- Settings (`src/app/(app)/settings`, sub-pages account, business, invoicing, numbering, registration, security, tax-rates, team): show the state on each row, a sticky save bar, and jump links.
- Team (`settings/team`): avatars and role pills.
- Sign-in and sign-up (`src/app/(auth)`): the visual upgrade. These pages keep the plain skeleton and their own Stamp beside the form.

### 3. Landing page wrap-up

The components, markup and motion CSS are done and committed. Left: add a landing-page section to `DESIGN.md` (there is none today) and run the full verification: component and CSS-contract tests, screenshots at desktop and phone widths, and behaviour under reduced motion.

### 4. Small decisions to revisit if you disagree

- Downloading the PDF of a registered invoice updates the invoice's `updated_at`, so it can move that customer's "Last activity". Left alone because the fix would change how invoices are ordered elsewhere.
- A sent quotation that is reopened for changes does not count toward an item's "Last used" until it is sent again, because its lines are mid-edit. It does still count as customer activity, from the day it was sent.

## How to run things

If you work in a normal terminal on the laptop:

```text
npm run lint
npm run typecheck
npm test                 # unit and component tests
npm run test:int         # integration; needs the Neon test branch (TEST_DATABASE_URL)
npm run test:e2e         # Playwright
```

Never point integration or e2e at the dev or production database. They refuse to run if `TEST_DATABASE_URL` equals `DATABASE_URL`.

If you use a Cowork session (cloud sandbox plus the laptop bridge), what worked:

- Do the build and test work in the sandbox copy, then deliver changed files to the laptop as a tarball and verify every file's hash after extracting (`tar --overwrite -xzf`; plain `-xzf` fails on the mounted folder).
- The laptop shell cannot run npm, cannot reach GitHub without your login, and cannot delete files until you approve it (git needs that to clear its own lock files). So commits from there use `git -c core.hooksPath=/dev/null commit`, and you push yourself.
- Sandbox Postgres runs on port 5544. If it has stopped, start it with `pg_ctl`. Only remove `postmaster.pid` when the server is really stopped: deleting it under a running server shuts the server down.
- For the e2e run, build with `DATABASE_URL` pointed at the test database, but run Playwright without exporting that override, or its guard refuses.

## Test conventions that save time

- Account-creating e2e specs run on desktop only and are listed in `ACCOUNT_CREATING_SPECS` in `playwright.config.ts`. A new spec that signs someone up goes in that list and gives itself its own visitor with `asVisitor(label)`.
- In the document editor, fill fields only after the first line has appeared (hydration), or the typed value is lost. For the catalog picker, wrap the interaction in `toPass` so it retries.
- Skeleton-versus-page check: hover the link, wait for the network to go idle, then delay only the real navigation request (`rsc === "1"` and not a prefetch) by 1.5 s, and compare bounding boxes of the loading screen and the loaded page. Tolerance is 2 px vertically and 1 px horizontally. Examples: `e2e/customer-record.spec.ts`, `e2e/document-panel.spec.ts`, `e2e/catalog-usage.spec.ts`.
- When a new status badge or tag appears in a list row, check the stand-in's height, because a 4 px difference shifts everything below it.
