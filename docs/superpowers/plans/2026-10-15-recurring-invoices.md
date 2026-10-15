# Recurring Billing Statements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a business repeat an issued bill on a weekly, monthly, quarterly or yearly schedule, with Tavi preparing one draft per due date for a person to review and send.

**Architecture:** Two new tables in the invoices module (`recurring_schedules` and its lines) plus two link columns on `invoices`, with a unique index that makes the daily job idempotent. Date arithmetic is pure domain code. Use cases run one transaction per schedule with an audit event. The existing `/api/cron/daily` job gains one call per business. The draft is written through the same row-writing code as `saveInvoiceDraft`, so totals come from the one calculation function.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Drizzle + Postgres (Neon), Vitest (unit, components, integration), Playwright, Tailwind v4, Base UI.

**Spec:** `docs/superpowers/specs/2026-10-15-recurring-invoices-design.md` (read it first; section numbers below refer to it).

## Global Constraints

- Money is `bigint` minor units; every total comes from `calculateDocument` via the existing `calculate()` in `src/modules/invoices/application/invoices.ts`. Nothing is hard-coded per market (D12): currency, locale and wording come from the business and `ctx.market`.
- Audit events are written inside the same transaction as the change (`recordAuditEvent(tx, ...)`), with actions added to `AUDIT_ACTIONS` in `src/modules/audit/domain/events.ts`. Permission is `invoices.write` for every schedule action (spec 2); reading uses `invoices.read`.
- A draft made by a schedule never takes a document number and never emails anyone (spec 1, 2). Numbers come only from `allocateDocumentNumber` when a person issues the draft.
- "Today" for a business is its own time zone's date (`todayIn(timezone, now)` from `@/shared/dates/calendar`); `next_run_on` is a calendar date, never a timestamp.
- Module boundaries: other modules are imported only through `@/modules/<name>` (server) or `@/modules/<name>/client` (pure code for client components). Only `application/`, `infra/`, `schema.ts` and tests touch the database; `domain/` stays pure.
- Every new route has a `loading.tsx` in the page's real layout built from `src/components/skeletons.tsx` (`src/app/loading-states.test.tsx` enforces it); a new folder under `src/app/(app)` is added to `PROTECTED_PREFIXES` in `src/shared/security/headers.ts`; typed routes are cast `as Route`; every sub-page has a visible Back link; lists use `DataTable` and the shared list components (standing data-table rule in `CLAUDE.md`).
- Carbon Copy design: semantic tokens only, no entrance animation, no count-ups. Feedback standard: a toast for every action, a dialog before ending a schedule. Every text field shows an `e.g. …` example via `eg()` (`src/app/field-placeholders.test.ts` fails otherwise).
- Server actions passed to client components are bound with `action.bind(null, id)`, never closures.
- Made-up data only in tests, fixtures and docs. Integration and e2e run only against the sandbox or Neon test database, never `DATABASE_URL`, dev or production.
- **Do not commit or push.** The user asks for commits; commit messages carry no co-author line or attribution trailer. Each task ends with a verify step.
- Tests first: write the test, run it, see it fail for the stated reason, then implement.
- Delivery: work happens in the cloud clone; changed files reach the laptop folder by tarball with a combined sha256 check, as in earlier deliveries.

## Review Focus

1. A schedule's tax rate is archived after the schedule was made: the next run must pause the schedule with a plain reason and create no draft, never fail the whole daily job (Tasks 3 and 4).
2. Two daily runs overlap, or the job runs twice in a day: exactly one draft per schedule per due date, no error surfaced (Task 4).
3. Start date in the past, or "today": a past date is refused with a message; today's date is accepted and the draft appears on that day's run (Tasks 1 and 3).
4. The source bill is a draft, void or cancelled: Repeat is refused (button hidden, use case returns `notRepeatable`) (Tasks 3 and 6).
5. A yearly schedule anchored on 29 February runs on 28 February in non-leap years and on the 29th in leap years; a gap of months creates one draft, not a stack (Tasks 1 and 4).

---

### Task 1: Recurrence rules (domain)

**Files:**
- Create: `src/modules/invoices/domain/recurrence.ts`, `src/modules/invoices/domain/recurrence.test.ts`
- Modify: `src/modules/invoices/index.ts`, `src/modules/invoices/client.ts` (export the items below)

**Interfaces:**
- Produces:
  - `RECURRENCE_FREQUENCIES = ["weekly","monthly","quarterly","yearly"] as const`, `type RecurrenceFrequency`
  - `type Recurrence = { frequency: RecurrenceFrequency; anchorDay: number; anchorMonth: number | null }` (anchorDay is 1–31, or 1–7 for weekly with Monday = 1; anchorMonth is 1–12 for yearly, else null)
  - `firstRunOn(rule: Recurrence, startOn: CalendarDate): CalendarDate` (first due date on or after `startOn`)
  - `nextRunOn(rule: Recurrence, after: CalendarDate): CalendarDate` (first due date strictly after `after`)
  - `parseRecurrence(input: unknown, { today }: { today: CalendarDate }): { ok: true; rule: Recurrence; startOn: CalendarDate; endsOn: CalendarDate | null; maxDrafts: number | null } | { ok: false; errors: Record<string, string> }`
  - `RECURRENCE_LIMITS = { maxDraftsMax: 120 }` and `recurrenceLabel(rule: Recurrence): string` (e.g. "Every month on the 15th")
  - `isFinished(s: { endsOn: CalendarDate | null; maxDrafts: number | null; draftsCreated: number }, nextRun: CalendarDate): boolean`

- [x] **Step 1: Write the failing tests** in `recurrence.test.ts`, each with exact dates: monthly on 31 → `2026-01-31`, then `2026-02-28`, `2026-03-31`, `2026-04-30`; monthly on 31 after a 29 Feb 2028 leap year gives `2028-02-29`; quarterly anchored 15 yields 15 Jan/Apr/Jul/Oct pattern from the start month; yearly 29 Feb → `2027-02-28`, `2028-02-29`; weekly Monday after Monday `2026-10-12` → `2026-10-19`; `firstRunOn` returns the start date itself when it is a due date; `parseRecurrence` rejects a start before `today` (`errors.startOn`), a day outside range (`errors.anchorDay`), an end date before the start (`errors.endsOn`), `maxDrafts` of 0 or above 120 (`errors.maxDrafts`), and a yearly rule with no month (`errors.anchorMonth`); `isFinished` is true when `draftsCreated >= maxDrafts` or `nextRun > endsOn`.
- [x] **Step 2: Run** `npx vitest run src/modules/invoices/domain/recurrence.test.ts`. Expected: FAIL, module not found.
- [x] **Step 3: Implement** the signatures above in `recurrence.ts` using the calendar helpers in `@/shared/dates/calendar` (no `Date` arithmetic on local time). Quarterly and monthly clamp the day to the month's length; quarterly steps three months from the start month.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Verify** `npx eslint src/modules/invoices && npx tsc --noEmit` is clean.

### Task 2: Schema, migration 0034, audit actions

**Files:**
- Create: `src/modules/invoices/recurring-schema.ts` (the two tables), `src/db/migrations/0034_<generated>.sql` and `meta/0034_snapshot.json` (generated)
- Modify: `src/modules/invoices/schema.ts` (columns `recurringScheduleId`, `recurringForDate` on `invoices`; unique index on both), `src/db/schema.ts` (list the new schema file), `src/modules/audit/domain/events.ts`, `src/db/migrations/meta/_journal.json` (generated)
- Test: `src/modules/invoices/application/recurring-schema.int.test.ts`

**Interfaces:**
- Produces: tables `recurringSchedules` and `recurringScheduleLines` (columns exactly as spec 4: frequency, anchor_day, anchor_month, next_run_on, ends_on, max_drafts, drafts_created, status, pause_reason, terms_days, currency, tax_mode, notes, terms, last_run_on, source_invoice_id, customer_id; lines mirror invoice draft lines: description, quantity, unit label, unit_price_minor, tax_rate_id, discount fields, product_id, position). Check constraints: frequency, status, `anchor_day between 1 and 31`, `anchor_month between 1 and 12`, `drafts_created >= 0`, `max_drafts is null or max_drafts between 1 and 120`. Composite FKs to customers and tax rates inside one organization. Audit actions: `recurring.created`, `recurring.updated`, `recurring.paused`, `recurring.resumed`, `recurring.ended`, `recurring.draft_created`.

- [x] **Step 1: Write the failing integration test**: inserting two invoices with the same `(recurring_schedule_id, recurring_for_date)` fails on the unique index; a schedule with `frequency = 'daily'` or `anchor_day = 32` fails its check; deleting a schedule sets its drafts' `recurring_schedule_id` to null and keeps the drafts.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/invoices/application/recurring-schema.int.test.ts` (with `TEST_DATABASE_URL` set to the sandbox database). Expected: FAIL, relation does not exist.
- [x] **Step 3: Implement** the schema, then `npm run db:generate` and review the SQL (additive only: new tables, two nullable columns, one unique index (nulls never collide), new checks).
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Verify** `src/modules/audit/domain/events.test.ts` (if it snapshots actions) and `npx tsc --noEmit` pass.

### Task 3: Schedule use cases

**Files:**
- Create: `src/modules/invoices/application/recurring.ts`, `src/modules/invoices/application/recurring.int.test.ts`
- Modify: `src/modules/invoices/index.ts`

**Interfaces:**
- Consumes: Task 1 `parseRecurrence`, `firstRunOn`, `nextRunOn`; Task 2 tables; `loadHeader`, `loadLines`, `audit` helpers from `invoices.ts`.
- Produces (all take `actor: OrgActor`, optional `db`):
  - `createSchedule(actor, sourceInvoiceId: string, input: unknown, { today }): Promise<{ ok: true; id: string } | { ok: false; notFound: true } | { ok: false; notRepeatable: true; status: InvoiceStatus } | { ok: false; errors: Record<string, string> }>`
  - `updateSchedule(actor, id, input: unknown, { today })`, `pauseSchedule(actor, id)`, `resumeSchedule(actor, id, { today })`, `endSchedule(actor, id)`, each returning `{ ok: true } | { ok: false; notFound: true } | { ok: false; wrongState: ScheduleStatus }`
  - `getSchedule(actor, id)` (schedule, lines, and its drafts' ids with numbers and statuses), `listSchedules(actor, { page, size, search, status })` with a real total
  - `type ScheduleStatus = "active" | "paused" | "ended"`

- [x] **Step 1: Write the failing integration tests**: create from an issued bill copies customer, currency, tax mode, lines, terms days (due date minus issue date), notes and terms; `next_run_on` equals `firstRunOn(rule, startOn)`; a DRAFT, VOID or CANCELLED source returns `notRepeatable`; a start date before today returns `errors.startOn`; a member role without `invoices.write` is refused; pause then resume sets `next_run_on` to the first due date after today with no backfill; ended schedules refuse pause and resume with `wrongState: "ended"`; editing the schedule's lines does not change the source bill; each action writes its audit row in the same transaction.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/invoices/application/recurring.int.test.ts`. Expected: FAIL, functions not defined.
- [x] **Step 3: Implement** the signatures. Lines are saved as the source bill's own resolved lines (description, quantity, price, tax rate id, discount), validated with the existing `parseInvoiceDraft` shape so pricing rules stay in one place. `updateSchedule` changes lines, frequency, anchors, end rule and notes; it applies to future drafts only.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Verify** lint and typecheck are clean.

### Task 4: Running due schedules

**Files:**
- Modify: `src/modules/invoices/application/invoices.ts` (extract the draft row writing from `saveInvoiceDraft` into an exported `insertDraftRows(tx, { organizationId, createdBy: string | null }, header, lines)`; `saveInvoiceDraft` calls it, behavior unchanged), `src/modules/invoices/application/recurring.ts`, `src/modules/invoices/index.ts`
- Test: `src/modules/invoices/application/recurring-run.int.test.ts`

**Interfaces:**
- Consumes: Task 3 schedules; Task 1 `nextRunOn`, `isFinished`; `calculate`, `headerAmounts`, `lineRows`.
- Produces: `runDueSchedules(organizationId: string, today: CalendarDate, db?: Database): Promise<{ created: number; paused: number }>`; a pause reason constant set `RECURRING_PAUSE_REASONS = { customerGone: ..., taxRateGone: ... }` with plain-language text.

- [x] **Step 1: Write the failing integration tests** with a schedule due on `2026-11-01`: running on `2026-11-01` creates exactly one DRAFT invoice with the saved lines, terms and `recurring_for_date = 2026-11-01`, no number, `created_by` null, status DRAFT, audit `recurring.draft_created`, and moves `next_run_on` to `2026-12-01`; running again the same day creates none and returns `created: 0`; two concurrent runs (`Promise.all`) leave one draft and no thrown error; running on `2027-02-10` after a gap creates one draft for the latest due date `2027-02-01` and sets `next_run_on = 2027-03-01`; the run that reaches `max_drafts` or `ends_on` sets status `ended`; a paused or ended schedule creates nothing; an archived customer pauses the schedule with the `customerGone` reason and creates nothing; an archived tax rate pauses it with `taxRateGone` and creates nothing; a schedule in another organization is not touched; the draft's due date is its issue date plus `terms_days`, where the issue date is `today`.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/invoices/application/recurring-run.int.test.ts`. Expected: FAIL, `runDueSchedules` not defined.
- [x] **Step 3: Implement** `runDueSchedules`: select due active schedule ids, then per schedule a transaction that locks the row (`for update`), re-checks status and `next_run_on`, resolves customer and tax rates directly by `organizationId` (no `OrgActor`, since no person acts), writes the draft with `insertDraftRows`, relies on the unique index with `on conflict do nothing` for the repeat case, then advances the schedule. Each schedule's failure is isolated.
- [x] **Step 4: Run** the same command and `npx vitest run --project integration src/modules/invoices/application/invoices.int.test.ts`. Expected: PASS (the refactor changed no behavior).
- [x] **Step 5: Verify** lint and typecheck are clean.

### Task 5: The daily job

**Files:**
- Modify: `src/app/api/cron/daily/route.ts`
- Test: `src/app/api/cron/daily/route.test.ts` (extend if present, else create)

**Interfaces:**
- Consumes: `runDueSchedules` (Task 4) through `@/modules/invoices`.
- Produces: the job response and log gain `recurringDrafts` and `recurringPaused` counts.

- [x] **Step 1: Write the failing test**: with `runDueSchedules` mocked to return `{ created: 2, paused: 1 }` for one business, the JSON response includes `recurringDrafts: 2` and `recurringPaused: 1`; when it throws for one business, the other business still runs and `failed` is 1.
- [x] **Step 2: Run** `npx vitest run src/app/api/cron/daily`. Expected: FAIL, counts missing.
- [x] **Step 3: Implement** the call inside the existing per-business `try` (closed businesses are already excluded by `listOrganizationClocks`) and add the counts to the response and `logger` line.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Verify** lint and typecheck are clean.

### Task 6: Repeat this (server actions and dialog)

**Files:**
- Create: `src/app/(app)/invoices/_components/repeat-dialog.tsx`, `src/app/(app)/invoices/_components/repeat-dialog.test.tsx`, `src/app/(app)/recurring/actions.ts`
- Modify: `src/app/(app)/invoices/[id]/(view)/page.tsx` (the button, shown only for a bill that is not DRAFT, VOID or CANCELLED and when `can(ctx, "invoices.write")`)

**Interfaces:**
- Consumes: Task 3 `createSchedule`, `RECURRENCE_FREQUENCIES`, `recurrenceLabel` through `@/modules/invoices/client`.
- Produces: `createScheduleAction(sourceInvoiceId: string, input: unknown)` returning `{ ok: true; id: string } | { ok: false; errors: Record<string, string> }`; `<RepeatDialog create={bound action} defaults={{ startOn: string }} />`.

- [x] **Step 1: Write the failing component test**: the dialog has fields "How often", "Day" (weekday names for weekly), "Month" (yearly only), "Starts on" with an `e.g. …` placeholder, "Ends on (optional)" and "Number of statements (optional)"; submitting calls the action with those values; a returned `errors.startOn` shows inline next to the field; success shows a toast "Repeating every month from 1 Nov 2026." with a "View schedule" action linking to `/recurring/<id>`.
- [x] **Step 2: Run** `npx vitest run "src/app/(app)/invoices/_components/repeat-dialog.test.tsx"`. Expected: FAIL, component not found.
- [x] **Step 3: Implement** the dialog (Base UI dialog, existing form-field and `FormAlert` components, state in the client) and the action (`requireOrgContext`, `assertCan`, bound with `.bind(null, id)` in the page).
- [x] **Step 4: Run** the same command and `npx vitest run src/app/field-placeholders.test.ts`. Expected: PASS.
- [x] **Step 5: Verify** lint and typecheck are clean.

### Task 7: Recurring pages, navigation, skeletons

**Files:**
- Create: `src/app/(app)/recurring/(list)/page.tsx`, `(list)/loading.tsx`, `[id]/(view)/page.tsx`, `[id]/(view)/loading.tsx`, `[id]/edit/page.tsx`, `[id]/edit/loading.tsx`, `_components/schedule-actions.tsx` (pause, resume, end with an end dialog), tests beside each component
- Modify: `src/components/app-shell/nav.ts` and `nav.test.ts` (an item "Recurring" between Invoices and Payments), `src/shared/security/headers.ts` (`"/recurring"` in `PROTECTED_PREFIXES`)
- Test: `src/app/loading-states.test.tsx` (existing), `src/shared/security/headers.test.ts` (existing, reads the folder)

**Interfaces:**
- Consumes: Task 3 `listSchedules`, `getSchedule`, `pauseSchedule`, `resumeSchedule`, `endSchedule`, `updateSchedule`; `DataTable`, `ListResults`, `SummaryStrip`.
- Produces: routes `/recurring`, `/recurring/[id]`, `/recurring/[id]/edit`.

- [x] **Step 1: Write the failing tests**: `nav.test.ts` expects "Recurring" in `primaryNav`; `headers.test.ts` fails until `/recurring` is protected; `loading-states.test.tsx` fails for each missing `loading.tsx`; `schedule-actions.test.tsx` expects Pause for an active schedule, Resume for a paused one with its `pause_reason` shown, nothing for an ended one, and that End opens a dialog stating "No more statements will be prepared. The ones already made stay." and calls the bound action only after confirming, with the toast "Schedule ended."
- [x] **Step 2: Run** `npx vitest run src/components/app-shell/nav.test.ts src/shared/security/headers.test.ts src/app/loading-states.test.tsx "src/app/(app)/recurring"`. Expected: FAIL.
- [x] **Step 3: Implement** the list (customer, what it repeats from the lines' total, `recurrenceLabel`, next run, drafts created, status with icon and label; fixed-height scrolling panel, pagination, page size, count, debounced search), the schedule page (lines and terms as saved, the drafts it made as links with numbers and status, Edit, Pause or Resume, End), the edit form (frequency, anchors, end rule, lines through the existing document line editor in a mode that never autosaves to an invoice), and each skeleton in the page's real layout. Edits say "Applies to the next statement onward."
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Verify** lint and typecheck are clean.

### Task 8: Draft badge and dashboard count

**Files:**
- Modify: the invoice view and edit pages under `src/app/(app)/invoices/[id]/` (a "From a recurring schedule" line with a link when `recurringScheduleId` is set), `src/modules/invoices/application/invoices.ts` (`getInvoice` returns `recurringScheduleId`), `src/modules/invoices/application/attention.ts` (new `recurringDraftsWaiting(actor, db)`), `src/app/(app)/dashboard/_lib/attention-items.ts` and its test
- Test: `src/modules/invoices/application/attention.int.test.ts`, `src/app/(app)/dashboard/_lib/attention-items.test.ts`

**Interfaces:**
- Consumes: Task 4 drafts with `recurring_schedule_id`.
- Produces: `recurringDraftsWaiting(actor: OrgActor, db?: Database): Promise<number>` (count of DRAFT invoices with a schedule id); an attention item "N recurring statements to review" linking to `/invoices?status=DRAFT`.

- [x] **Step 1: Write the failing tests**: the count includes only DRAFT bills with a schedule id, in the actor's organization; `attentionItems` adds the item only when the count is above zero, with singular wording for one ("1 recurring statement to review").
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/invoices/application/attention.int.test.ts` and `npx vitest run "src/app/(app)/dashboard/_lib"`. Expected: FAIL.
- [x] **Step 3: Implement** the query, wire it into the dashboard page's existing `Promise.all`, and show the source line on the invoice pages.
- [x] **Step 4: Run** the same commands. Expected: PASS.
- [x] **Step 5: Verify** lint and typecheck are clean.

### Task 9: Privacy export, register and decision log

**Files:**
- Modify: `src/modules/invoices/infra/export.ts` (add `recurringSchedules` with their lines), `src/modules/privacy/domain/export.ts` (`EXPORT_NOTES` entry), `docs/compliance/processing-register.md`, `docs/foundation-proposal.md` (new decision row, "Recurring billing statements" under the roadmap), `DESIGN.md` only if a new component pattern appears
- Test: `src/modules/invoices/infra/export.int.test.ts` (extend or create), `src/modules/privacy` export test

**Interfaces:**
- Consumes: Task 2 tables. Produces: export key `recurringSchedules`.

- [x] **Step 1: Write the failing integration test**: a business with one schedule and two lines exports `recurringSchedules` with the lines nested, and another business's schedule is absent.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/invoices/infra/export.int.test.ts src/modules/privacy`. Expected: FAIL.
- [x] **Step 3: Implement** the export and write the notes; the Privacy Notice needs no change (spec 8), and `LEGAL.version` is not bumped.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Verify** `npx vitest run src/modules/privacy src/app/\(legal\)` passes.

### Task 10: End-to-end, loading screens and full verification

**Files:**
- Create: `e2e/recurring.spec.ts`, `e2e/recurring-loading.spec.ts`
- Modify: `playwright.config.ts` (add both to `ACCOUNT_CREATING_SPECS`)

**Interfaces:**
- Consumes: everything above. A test helper in `e2e/helpers.ts` that runs the due job for a business against the test database: `runRecurringJobFor(email: string, today: string)` calling `runDueSchedules` directly (the job route needs `CRON_SECRET`; do not put secrets in specs).

- [x] **Step 1: Write the failing specs**: (a) the owner issues a bill, taps Repeat this, picks monthly from today, sees the toast and the schedule on `/recurring`; the job helper runs; the dashboard shows "1 recurring statement to review"; the draft opens with "From a recurring schedule" and issuing it allocates the next number; (b) a member without write access sees no Repeat this button and `/recurring` offers no create or pause controls; (c) ending a schedule asks first and the list shows "Ended"; (d) skeleton-vs-page for the Recurring list and a schedule page, copying the comparator in `e2e/withholding-loading.spec.ts`.
- [x] **Step 2: Run** on a production build: `CI=1` with the sandbox runner for `e2e/recurring.spec.ts e2e/recurring-loading.spec.ts --project=setup --project=desktop --retries=0 --workers=1`. Expected: FAIL before the pieces exist, then PASS.
- [x] **Step 3: Run the whole verification**: `npm run lint`, `npm run typecheck`, `npm test`, `npx vitest run --project integration`, then the full e2e (`--project=setup --project=desktop --project=mobile`, `CI=1`, one worker; integration and e2e share the test database, so never run them at the same time). Expected: all green.
- [x] **Step 4: Tidy**: remove temporary files (`playwright.local.config.ts`, `.next-e2e`, `test-results`), `git checkout AGENTS.md`, confirm `git status` shows only files named in this plan plus the generated migration and snapshot.
- [x] **Step 5: Report** to the user with a short summary and wait. Production migration 0034 is applied by the deploy (`vercel-build`); it only adds tables and columns.
