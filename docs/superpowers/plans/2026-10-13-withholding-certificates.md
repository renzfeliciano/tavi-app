# Withholding-tax certificates (BIR Form 2307) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a business record the BIR 2307 certificates its customers send, link them to the payments they cover, see which withholding is still pending, and report creditable tax by quarter and payor with CSV.

**Architecture:** Three new tables in the payments module (certificates, rows, payment links), with "pending" derived from `payments.withheld_minor` plus the absence of a link. Pure rules live in a domain file; use cases run in one transaction with an audit event; scans reuse the files store with a new purpose. UI is three new pages under `/payments/withholding`, badges on existing payment views, and a Reports section.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Drizzle + Postgres (Neon), Vitest (unit, components, integration), Playwright, Tailwind v4, Base UI.

**Spec:** `docs/superpowers/specs/2026-10-13-withholding-certificates-design.md` (read it first; section numbers below refer to it).

## Global Constraints

- Money is `bigint` minor units; certificate and payment currency must match. Rates are stored as `rate_bps` data; no rate is hard-coded in logic (spec 3).
- Audit events are written inside the same transaction as the change (`recordAuditEvent(tx, ...)`). Permissions go through `assertCan`: `payments.record` to record or edit, `payments.void` to void, `payments.read` to read.
- Module boundaries: import other modules only through `@/modules/<name>` (server) or `@/modules/<name>/client` (pure code for client components). New payments code is exported from `src/modules/payments/index.ts` and, if pure, `client.ts`.
- Every new route has a `loading.tsx` (enforced by `src/app/loading-states.test.tsx`); typed routes are cast `as Route`; every sub-page has a visible Back button; wording comes from the market profile ("Billing statement", "Quotation"); WCAG AA in light and dark, `cursor-pointer` on interactive elements, mobile first with no horizontal scroll.
- Made-up data only in tests, fixtures and docs (no real TINs, names or addresses). Never run tests against the dev or production database; integration and e2e use the Neon test branch.
- **Do not commit.** The user confirms commits at the end, and commit messages carry no co-author line or attribution trailer. Each task ends with a verify step instead of a commit step.
- Unit and component tests run on the Linux copy: sync with `rsync -a --exclude node_modules --exclude .next --exclude .next-e2e --exclude .git --exclude test-results --exclude playwright-report --exclude .env.local ./ /tmp/tavi-linux/` then run `npx vitest run --project unit --project components <path>` there. Integration and e2e need Postgres on 5432, so the user runs those on their Windows machine: `npx vitest run --project integration <path>` and `npx playwright test <spec>`.
- The migration is applied to the test branch by the test setup. It is applied to production Neon only after the user reviews it, keeping `drizzle.__drizzle_migrations` in sync.

## Review Focus

1. A linked payment is voided: its link disappears and the certificate shows "Differs by" (Task 4).
2. Two admins link the same payment to different certificates at once: exactly one succeeds, the other gets a `paymentIds` error, never a 500 (Task 4).
3. Quarter edges: Q4 ends 31 Dec and Q1 starts 1 Jan; a payment dated on the first or last day links, a day outside does not (Tasks 1 and 4).
4. Money edges: half-centavo rounding goes up, tax above income is rejected, an input like `₱1,200.50` parses, blank months count as zero (Task 1).
5. A TIN typed with spaces, dashes or letters is rejected or cleaned, and a payor name that starts with `=`, `+`, `-` or `@` is neutralised in the CSV (Tasks 1 and 6).

---

### Task 1: Pure rules (domain)

**Files:**
- Create: `src/modules/payments/domain/withholding.ts`, `src/modules/payments/domain/withholding.test.ts`
- Modify: `src/modules/payments/index.ts`, `src/modules/payments/client.ts` (export the items below)

**Interfaces:**
- Produces (all exported):
  - `type Quarter = 1 | 2 | 3 | 4`; `quarterBounds(year: number, quarter: Quarter): { from: CalendarDate; to: CalendarDate }`; `quarterOf(date: CalendarDate): { year: number; quarter: Quarter }`; `monthNamesOfQuarter(quarter: Quarter, locale: string): [string, string, string]`
  - `defaultTaxWithheld(totalMinor: number, rateBps: number): number` (integer maths, half up)
  - `type WithholdingStatus = "none" | "pending" | "received"`; `withholdingStatus(withheldMinor: number, linked: boolean): WithholdingStatus`
  - `reconcile(certificateTaxMinor: number, linkedTaxMinor: number): { matches: boolean; differenceMinor: number }` (difference = certificate minus linked)
  - `WITHHOLDING_LIMITS = { tin: 20, name: 120, address: 200, notes: 500, atc: 10, description: 120, maxRows: 5 }`
  - `LINK_MESSAGES`: `notFound` "One of those payments can't be found.", `otherCustomer` "That payment belongs to another customer.", `voided` "That payment was voided.", `noWithheld` "That payment has no tax withheld.", `currency` "That payment is in a different currency.", `outsidePeriod` "That payment is dated outside the period on the certificate.", `alreadyLinked` "That payment is already on another 2307."
  - `type RawCertificateLine = { atcCode: string; description: string; rate: string; month1: string; month2: string; month3: string; taxWithheld: string }` (rate is a percent like `"2"` or `"2.5"`)
  - `type RawCertificate = { customerId: string; payorTin: string; payorName: string; payorAddress: string; year: string; quarter: string; receivedOn: string; notes: string; lines: RawCertificateLine[]; paymentIds: string[] }`
  - `type CertificateLineInput = { position: number; atcCode: string; description: string | null; rateBps: number; monthMinor: [number, number, number]; totalMinor: number; taxWithheldMinor: number }`
  - `type CertificateInput = { customerId: string; payorTin: string; payorName: string; payorAddress: string | null; periodFrom: CalendarDate; periodTo: CalendarDate; receivedOn: CalendarDate; notes: string | null; lines: CertificateLineInput[]; paymentIds: string[] }`
  - `parseCertificateInput(raw: RawCertificate, options: { currency: string; locale: string; today: CalendarDate }): { ok: true; value: CertificateInput } | { ok: false; errors: Record<string, string> }`

- [x] **Step 1: Write the failing tests** in `withholding.test.ts`: `quarterBounds(2026, 4)` is `2026-10-01`/`2026-12-31`, `(2028, 1)` ends `2028-03-31`; `quarterOf("2026-12-31")` is year 2026 quarter 4 and `"2027-01-01"` is 2027 Q1; `defaultTaxWithheld(100_000, 200) === 2000`, `defaultTaxWithheld(25, 200) === 1` (0.5 rounds up), `(0, 200) === 0`; `withholdingStatus(0, false) === "none"`, `(5000, false) === "pending"`, `(5000, true) === "received"`; `reconcile(2000, 2000)` matches, `reconcile(2000, 1500)` gives `differenceMinor: 500`; `parseCertificateInput` accepts a made-up valid certificate (rate `"2"` gives `rateBps: 200`; `month1: "₱1,200.50"` gives `120050`; blank months are 0; the total is the sum of the months) and returns error keys `payorTin` (8 digits, letters), `payorName`, `quarter`, `receivedOn` (future date, not a date), `lines` (none, six rows), `lines.0.atcCode`, `lines.0.rate` (`"0"`, `"101"`), `lines.0.month1` (`"abc"`), `lines.0.total` (all months blank), `lines.0.taxWithheld` (blank, or above the total). `payorTin` is kept as typed after trimming and collapsing spaces (`"123 456 789 000"` and `"123-456-789-000"` stay valid; the digit count must be at least 9).
- [x] **Step 2: Run** `npx vitest run --project unit src/modules/payments/domain/withholding.test.ts` on the Linux copy. Expected: FAIL (module not found).
- [x] **Step 3: Implement** the interfaces in `withholding.ts`. Use `parseMoneyInput(text, currency, locale)` (as `readAmount` does in `payment-input.ts`) for amounts and `isCalendarDate`/`compareDates` from `@/shared/dates/calendar`. A calculated default for `taxWithheld` is not applied here (the form pre-fills it); a blank `taxWithheld` is an error. The period is the full calendar quarter of `year` and `quarter`.
- [x] **Step 4: Run the test again.** Expected: PASS. Then `npx tsc --noEmit` and `npx eslint src/modules/payments`.

### Task 2: Schema, migration 0030, files purpose, audit actions, market profile

**Files:**
- Modify: `src/modules/payments/schema.ts` (three tables), `src/modules/files/domain/limits.ts` (`FILE_PURPOSES` gains `"withholding_certificate"`), `src/modules/files/schema.ts` (extend checks `files_purpose` and `files_purpose_shape`: this purpose needs `file_name` and has no `doc_kind`), `src/modules/audit/domain/events.ts` (add `"withholding_certificate.recorded"`, `".updated"`, `".voided"`, `".payment_unlinked"`), `src/config/markets.ts` (`MarketProfile.withholdingAtcs: readonly { code: string; rateBps: number }[]`; PH value `[{ code: "WI160", rateBps: 200 }]`; empty for any market without `taxWithheld`)
- Create: `src/db/migrations/0030_withholding_certificates.sql` (generated), `src/modules/payments/schema.int.test.ts`

**Interfaces:**
- Produces: Drizzle tables `withholdingCertificates`, `withholdingCertificateLines`, `withholdingCertificatePayments` exactly as in spec section 4 (column names snake_case: `payor_tin`, `period_from`, `period_to`, `received_on`, `file_id`, `rate_bps`, `month1_minor`, `month2_minor`, `month3_minor`, `total_minor`, `tax_withheld_minor`), exported from `payments/schema.ts` (already re-exported by `src/db/schema.ts`).

- [x] **Step 1: Write the failing integration test** `schema.int.test.ts` (made-up data; reuse the helpers from `payments.int.test.ts`): inserting a certificate whose period spans two quarters fails the quarter check; a line whose `total_minor` differs from the three months fails; a line with `tax_withheld_minor` above `total_minor` fails; two links to the same `payment_id` fail on the unique index; a voided certificate without `void_reason` fails; a `files` row with purpose `withholding_certificate` and no `file_name` fails the shape check, and one with a name passes.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/payments/schema.int.test.ts` (user runs). Expected: FAIL (tables missing).
- [x] **Step 3: Implement** the schema and config changes above, following the style of `payments` in `schema.ts` (composite foreign keys `(organization_id, id)`, `check()` helpers, `id()`/`timestamps()`). Run `npm run db:generate`, name the file `0030_withholding_certificates`, and read the SQL: it must add the three tables, replace the two `files` checks, and nothing else.
- [x] **Step 4: Run the integration test again** (user runs; the test setup applies the migration to the test branch). Expected: PASS. Run `npx tsc --noEmit`.

### Task 3: Scan storage in the files module

**Files:**
- Create: `src/modules/files/application/withholding-scans.ts`
- Modify: `src/modules/files/index.ts`, `src/modules/files/domain/limits.ts` (add `WITHHOLDING_SCANS = { fileName: 120 }`; reuse `MAX_UPLOAD_BYTES` and `DOCUMENT_MESSAGES`)
- Modify: `readOrganizationFile` in `registration-documents.ts` (type `purpose` gains the new value; this purpose requires `payments.read` via `can`)
- Test: `src/modules/files/application/withholding-scans.int.test.ts`

**Interfaces:**
- Produces: `uploadWithholdingScan(actor: OrgActor, input: { bytes: Uint8Array; fileName: string }, db?: Database): Promise<{ ok: true; fileId: string; fileName: string; contentType: string } | { ok: false; error: string }>` (needs `payments.record`; stores purpose `withholding_certificate`; PDF kept as-is, images re-encoded through `normalizeDocumentImage`); `removeWithholdingScan(executor: Executor, actor: OrgActor, fileId: string): Promise<void>` (deletes only that organization's file of this purpose; no audit of its own, the caller's event covers it).

- [x] **Step 1: Write the failing tests:** a PDF and a PNG upload succeed and read back through `readOrganizationFile` for an admin and for a member (`payments.read`); a 3 MiB file, an empty file, and an `.exe` renamed to `.pdf` return the matching `DOCUMENT_MESSAGES` text; a member cannot upload (ForbiddenError); another organization cannot read the file; uploads do not count toward the 8-document registration limit (upload 8 registration documents, then a scan still succeeds); `removeWithholdingScan` leaves a registration document with the same id shape alone.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/files/application/withholding-scans.int.test.ts` (user runs). Expected: FAIL.
- [x] **Step 3: Implement** by following `uploadRegistrationDocument` (type checks, normalise, insert) without the per-business count or the organization lock; `cleanFileName(input.fileName, "2307")` for the stored name.
- [x] **Step 4: Run again** (user runs). Expected: PASS. `npx tsc --noEmit`, `npx eslint src/modules/files`.

### Task 4: Certificate use cases (record, update, void, payment-void unlink)

**Files:**
- Create: `src/modules/payments/application/certificates.ts`, `src/modules/payments/application/certificates.int.test.ts`
- Modify: `src/modules/payments/application/payments.ts` (`voidPayment` deletes that payment's link row in its transaction and audits `withholding_certificate.payment_unlinked` with `{ certificateId, paymentId }`), `src/modules/payments/index.ts`

**Interfaces:**
- Consumes: Task 1 domain, Task 2 tables, Task 3 `removeWithholdingScan`.
- Produces:
  - `type CertificateResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> } | { ok: false; notFound: true } | { ok: false; error: string }`
  - The certificate's `currency` is `options.market.currency`, and a payment must have that currency to link.
  - `recordCertificate(actor: OrgActor, raw: RawCertificate, options: { market: MarketProfile; fileId?: string | null; now?: Date }, db?: Database): Promise<CertificateResult>`
  - `updateCertificate(actor, id: string, raw: RawCertificate, options: { market; fileId?: string | null; now?: Date }, db?): Promise<CertificateResult>` (`fileId` undefined keeps the scan, `null` removes it, a string replaces it and deletes the old file; the customer cannot change; a voided certificate returns `{ ok: false, error }`)
  - `voidCertificate(actor, id: string, rawReason: string, db?, now?): Promise<{ ok: true } | { ok: false; errors: Record<string, string> } | { ok: false; notFound: true } | { ok: false; error: string }>` (reason required, at most 500 characters, as in `voidPayment`)
  - Link errors use key `paymentIds` with a `LINK_MESSAGES` text. Audit actions as in Task 2, `entityType: "withholding_certificate"`, metadata with counts and ids only (never the TIN).

- [x] **Step 1: Write the failing integration tests** (made-up data, using `sentInvoice`-style helpers from `payments.int.test.ts`): record with two linked payments saves header, rows and links and writes one audit event; with no links it saves; each link rule returns its `LINK_MESSAGES` text under `paymentIds` (other customer, voided, no tax withheld, other currency, dated outside the quarter, on another certificate); a payment dated on the quarter's first day and last day links; the same two payments in two simultaneous `recordCertificate` calls give exactly one `ok` and one `paymentIds` error (`Promise.all`); `updateCertificate` replaces rows and links, keeps or replaces the scan as described, writes an audit event with before/after counts, and refuses a voided certificate; `voidCertificate` sets the void columns, deletes the links so `withholdingStatus` is pending again, audits with the unlinked payment ids, and a second void returns an error; voiding a linked payment removes its link and writes `payment_unlinked`; a member gets `ForbiddenError` for record, update and void; another organization's certificate id returns `notFound`.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/payments/application/certificates.int.test.ts` (user runs). Expected: FAIL.
- [x] **Step 3: Implement** in one transaction each. Parse with `parseCertificateInput` (currency and locale from `options.market`; today from the organization's timezone as `recordPayment` does), verify the customer belongs to the organization, then lock and validate each payment `for update` in id order before inserting links. Translate the unique-violation on `payment_id` into the `alreadyLinked` message instead of throwing.
- [x] **Step 4: Run again** (user runs). Expected: PASS, and `payments.int.test.ts` still passes. `npx tsc --noEmit`, `npx eslint src/modules/payments`.

### Task 5: Queries

**Files:**
- Create: `src/modules/payments/application/certificate-queries.ts`, `src/modules/payments/application/certificate-queries.int.test.ts`
- Modify: `src/modules/payments/application/payments.ts` (`listPayments` accepts `withholding?: "pending"`), `src/modules/payments/index.ts`

**Interfaces:**
- Produces (all need `payments.read`):
  - `type CertificateSummary = { id: string; customerId: string; customerName: string; payorTin: string; payorName: string; periodFrom: CalendarDate; periodTo: CalendarDate; receivedOn: CalendarDate; currency: string; taxWithheldMinor: number; atcCodes: string[]; linkedCount: number; hasScan: boolean; reconciliation: { matches: boolean; differenceMinor: number }; voidedAt: Date | null }`
  - `type CertificateLine = CertificateLineInput & { id: string }`; `type LinkedPayment = { paymentId: string; receiptNumber: string; paidOn: CalendarDate; invoiceId: string; invoiceNumber: string; amountMinor: number; withheldMinor: number }`; `type CertificateDetail = CertificateSummary & { payorAddress: string | null; notes: string | null; voidReason: string | null; fileId: string | null; fileName: string | null; lines: CertificateLine[]; payments: LinkedPayment[] }`
  - `listCertificates(actor, filter: { year?: number; quarter?: Quarter; customerId?: string; voided?: boolean }, db?): Promise<CertificateSummary[]>` (newest `received_on` first; voided hidden unless `voided: true`)
  - `getCertificate(actor, id: string, db?): Promise<CertificateDetail | null>`
  - `type PendingGroup = { customerId: string; customerName: string; currency: string; paymentCount: number; withheldMinor: number; oldestPaidOn: CalendarDate }`; `listPendingByCustomer(actor, db?): Promise<PendingGroup[]>`
  - `type PendingPayment = { paymentId: string; receiptNumber: string; paidOn: CalendarDate; invoiceId: string; invoiceNumber: string; withheldMinor: number; currency: string }`; `pendingPaymentsForCustomer(actor, customerId: string, options?: { period?: { from: CalendarDate; to: CalendarDate }; alsoOnCertificate?: string }, db?): Promise<PendingPayment[]>`
  - `paymentWithholdingStatus(actor, paymentIds: readonly string[], db?): Promise<Map<string, WithholdingStatus>>`
  - `withholdingForPayments(actor, paymentIds: readonly string[], db?): Promise<Map<string, { amountMinor: number; withheldMinor: number; grossMinor: number; status: WithholdingStatus; certificateId: string | null }>>` (for Phase 5B)

- [x] **Step 1: Write the failing integration tests:** pending groups sum only active, unlinked payments with tax withheld and ignore voided and linked ones; `pendingPaymentsForCustomer` honours the period and `alsoOnCertificate`; `listCertificates` filters by year, quarter, customer and voided; `getCertificate` returns rows, linked payments with billing statement numbers, the reconciliation (`differenceMinor` = certificate minus linked), and `null` for another organization's id or a non-UUID; `paymentWithholdingStatus` returns none, pending and received correctly and omits voided payments; `withholdingForPayments` returns gross = amount + withheld; `listPayments({ withholding: "pending" })` returns only pending payments and its `total` matches; members can call all of them.
- [x] **Step 2: Run** `npx vitest run --project integration src/modules/payments/application/certificate-queries.int.test.ts` (user runs). Expected: FAIL.
- [x] **Step 3: Implement** with explicit column selects and grouped queries (no per-row queries in loops).
- [x] **Step 4: Run again** (user runs). Expected: PASS. `npx tsc --noEmit`.

### Task 6: Report and CSV

**Files:**
- Create: `src/modules/payments/application/withholding-report.ts`, `src/modules/payments/application/withholding-report.int.test.ts`
- Modify: `src/app/(app)/reports/_lib/report-csv.ts` (add `withholdingCsv`), `src/app/(app)/reports/_lib/report-csv.test.ts`, `src/app/(app)/reports/csv/route.ts` (case `"withholding"`, params `year` and `quarter`, filename `withholding-<year>-Q<quarter>`), `src/modules/payments/index.ts`

**Interfaces:**
- Produces:
  - `type WithholdingCsvRow = { status: "Received" | "Pending"; payorTin: string; payorName: string; receivedOn: CalendarDate | null; atcCode: string | null; rateBps: number | null; monthMinor: [number, number, number] | null; totalMinor: number | null; taxWithheldMinor: number; billingStatements: string; hasScan: boolean | null; currency: string }`
  - `type WithholdingReport = { year: number; quarter: Quarter; received: { payorTin: string; payorName: string; currency: string; taxWithheldMinor: number; lines: { atcCode: string; rateBps: number; incomeMinor: number; taxWithheldMinor: number; certificateCount: number }[] }[]; waiting: { customerId: string; customerName: string; currency: string; paymentCount: number; withheldMinor: number }[]; totals: { currency: string; incomeMinor: number; taxWithheldMinor: number }[]; rows: WithholdingCsvRow[] }`
  - `withholdingReport(actor, options: { year: number; quarter: Quarter }, db?): Promise<WithholdingReport>` (needs `payments.read`; the quarter is the calendar quarter of `period_from`; voided certificates excluded; payors grouped by TIN digits with the name from the latest certificate; `waiting` is pending payments whose `paid_on` is in the quarter and is never added into `received` or `totals`)
  - `withholdingCsv(rows: readonly WithholdingCsvRow[], market: Market): string` with columns Status, Payor TIN, Payor name, Received on, ATC, Rate %, Month 1, Month 2, Month 3, Total income payments, Tax withheld, Billing statements, Has scan, Currency (pending rows leave ATC, rate, months, total and Has scan blank). Built with `toCsv` so the formula guard applies.

- [x] **Step 1: Write the failing tests:** integration: two certificates for one payor and two ATCs group correctly, a voided one is excluded, a certificate dated in Q4 does not appear in Q3, `waiting` and `received` stay separate, totals are per currency, rows contain one row per certificate row plus one per pending payment; unit (`report-csv.test.ts`): header order, `Pending` rows have blank ATC/rate/months/total, rate prints as `2.00`, a payor name `=cmd|x` is written as `'=cmd|x`, money prints through the same `money` helper as `paymentsCsv`; route behaviour: a member gets 404, a bad `year` or `quarter` gets 400.
- [x] **Step 2: Run** the integration test (user runs) and `npx vitest run --project unit src/app/(app)/reports/_lib/report-csv.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** the report with grouped SQL and the CSV builder; keep the route's existing owner/admin gate (`reports.read`).
- [x] **Step 4: Run again.** Expected: PASS. `npx tsc --noEmit`.

### Task 7: Badges and the pending filter

**Files:**
- Create: `src/app/(app)/payments/_components/withholding-badge.tsx`, `withholding-badge.test.tsx`
- Modify: `src/app/(app)/payments/(list)/page.tsx` (badge on each row with tax withheld, a "2307 pending" filter link using `?withholding=pending` and `listHref`), `src/app/(app)/payments/[id]/page.tsx` (badge and, for pending and `payments.record`, a "Record 2307" link to `/payments/withholding/new?customer=<id>`), `src/app/(app)/invoices/_components/invoice-payments.tsx` and its page (badge beside the existing withheld text)

**Interfaces:**
- Consumes: `paymentWithholdingStatus`, `listPayments({ withholding })` (Task 5).
- Produces: `WithholdingBadge({ status }: { status: WithholdingStatus })`: renders nothing for `none`; "2307 pending" (warning tone) and "2307 received" (success tone) otherwise, each with an icon plus text, in the same style tokens as `StatusBadge`.

- [x] **Step 1: Write the failing component tests:** nothing for `none`; the two labels; the pending filter link keeps `page` reset; the badge has accessible text and no colour-only meaning.
- [x] **Step 2: Run** `npx vitest run --project components src/app/(app)/payments` on the Linux copy. Expected: FAIL.
- [x] **Step 3: Implement** the badge and wire the three views (one `paymentWithholdingStatus` call per page, not per row). The label "2307" comes from `market.taxWithheld.label`'s form name; when `market.taxWithheld` is null nothing is shown anywhere in this feature.
- [x] **Step 4: Run again.** Expected: PASS. `npx tsc --noEmit`, `npx eslint`.

### Task 8: Withholding page (list)

**Files:**
- Create: `src/app/(app)/payments/withholding/(list)/page.tsx`, `loading.tsx`, `_components/pending-list.tsx`, `_components/certificate-list.tsx`, with tests beside them
- Modify: `src/app/(app)/payments/(list)/page.tsx` (a "Withholding (2307)" link in the `PageHeader` actions, shown only when the market has `taxWithheld`)
- The Withholding page's own header has a "Record a 2307" button to `/payments/withholding/new` (shown with `payments.record`)

**Interfaces:**
- Consumes: `listPendingByCustomer`, `listCertificates` (Task 5).
- Produces: route `/payments/withholding` with a Back button to Payments; section "Waiting for a 2307" (per customer: payments, tax withheld, oldest payment date, "Record 2307" link to `/payments/withholding/new?customer=<id>`, hidden without `payments.record`) and section "Received" (payor, quarter label like `Q3 2026`, ATC codes, tax withheld, scan icon with text, "Matches" or "Differs by ₱X", a "Voided" filter via `?voided=1`, rows link to `/payments/withholding/<id>`); `SectionEmpty` states that say what a 2307 is in one line.

- [x] **Step 1: Write the failing component tests** for both lists: rows, empty states, the Record button hidden for a member, the differs text, the voided filter link, and quarter labels (`2026-07-01` shows `Q3 2026`).
- [x] **Step 2: Run** `npx vitest run --project components src/app/(app)/payments/withholding` on the Linux copy and `src/app/loading-states.test.tsx`. Expected: FAIL.
- [x] **Step 3: Implement** the page, its `loading.tsx` in the same layout, and the list components using `SectionEmpty`, `PageHeader` and `BackLink` as the Payments page does; mobile rows become cards.
- [x] **Step 4: Run again.** Expected: PASS. `npx tsc --noEmit`, `npx eslint`.

### Task 9: Record and edit 2307 (form and actions)

**Files:**
- Create: `src/app/(app)/payments/withholding/new/page.tsx` and `loading.tsx`, `src/app/(app)/payments/withholding/[id]/edit/page.tsx` and `loading.tsx`, `_components/certificate-form.tsx`, `certificate-form.test.tsx`, `src/app/(app)/payments/withholding/actions.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5.
- Produces: `recordCertificateAction(formData: FormData)` and `updateCertificateAction(id: string, formData: FormData)`, each reading `data` (JSON of `RawCertificate`), `scan` (optional `File`) and, for update, `removeScan` (`"1"`); they upload the scan first, call the use case, delete the scan again if the use case fails, revalidate `/payments` and `/payments/withholding`, and return `{ ok: true; id: string } | { ok: false; errors: Record<string, string> } | { ok: false; error: string }`. `CertificateForm({ market, customers, initial, pendingPayments })` is a client component: payor fields (name and address prefilled from the customer, TIN from `customer.taxId`), year and quarter (current quarter by default), received-on, 1 to 5 rows (ATC choice from `market.withholdingAtcs` plus "Other" which reveals free ATC and rate fields; the three month fields labelled with `monthNamesOfQuarter`; total and tax withheld calculated with `defaultTaxWithheld` until the person edits tax withheld), scan upload (PDF, PNG, JPG, WebP, 2 MiB), notes, the customer's pending payments in the quarter pre-ticked, and a live line using `reconcile` ("Matches" or "Differs by ₱X").

- [x] **Step 1: Write the failing component tests:** adding and removing rows (max 5); picking WI160 fills the rate with `2`; typing months updates total and tax withheld, and editing tax withheld stops auto-calculation; changing the quarter reloads the ticked payments list from props filtered by dates; the live line switches between Matches and Differs; field errors from the action show next to the field and focus the first one; the submit button shows progress and is disabled while saving; labels and `aria-describedby` are present.
- [x] **Step 2: Run** `npx vitest run --project components src/app/(app)/payments/withholding` and `src/app/loading-states.test.tsx` on the Linux copy. Expected: FAIL.
- [x] **Step 3: Implement** the form (mobile first, one column on a phone, same field components and error pattern as the record-payment form in `invoice-payments.tsx`), the two pages (server components that call `requireOrgContext`, check `payments.record`, load the customer list and pending payments with `pendingPaymentsForCustomer`), and the actions. `new` requires `?customer=<id>`: without it the page shows a "Who sent this 2307?" chooser (links to `?customer=<id>`, using the customer list the invoice editor's picker uses), so a certificate can also be recorded for a customer with no pending payments. The page loads all of that customer's pending payments and the form filters them by the chosen quarter with `quarterBounds`. Edit passes `alsoOnCertificate`.
- [x] **Step 4: Run again.** Expected: PASS. `npx tsc --noEmit`, `npx eslint`.

### Task 10: Certificate page and void

**Files:**
- Create: `src/app/(app)/payments/withholding/[id]/page.tsx`, `loading.tsx`, `_components/void-certificate-dialog.tsx`, `void-certificate-dialog.test.tsx`
- Modify: `src/app/(app)/payments/withholding/actions.ts` (`voidCertificateAction(id: string, reason: string)`)

**Interfaces:**
- Consumes: `getCertificate`, `voidCertificate`.
- Produces: route `/payments/withholding/[id]` with Back to Withholding; a paper-like summary of the form (payor block, period, rows with month amounts, total, tax withheld), the scan (link to `/api/files/<id>`, PDFs download, images open), linked payments and billing statements as links, the reconciliation line, a voided banner with the reason when voided, `Edit` and `Void` shown only with the right permissions and hidden once voided. `VoidCertificateDialog` uses `DialogContent mascot="concerned" tone="danger"`, a required reason field with the same copy pattern as the void-payment dialog, and states that the payments return to "2307 pending".

- [x] **Step 1: Write the failing component tests:** the dialog requires a reason, shows the server error, closes on success; the page's Void and Edit buttons are hidden for a member and for a voided certificate.
- [x] **Step 2: Run** the components tests and the loading-states test on the Linux copy. Expected: FAIL.
- [x] **Step 3: Implement** the page (`notFound()` for an unknown id) and dialog.
- [x] **Step 4: Run again.** Expected: PASS. `npx tsc --noEmit`, `npx eslint`.

### Task 11: Reports section

**Files:**
- Modify: `src/app/(app)/reports/page.tsx`; Create: `src/app/(app)/reports/_components/withholding-section.tsx` and test

**Interfaces:**
- Consumes: `withholdingReport`, `quarterOf`, `quarterBounds` (Tasks 1 and 6).
- Produces: a "Creditable tax withheld (2307)" section, shown only when `market.taxWithheld` exists, with a year and quarter picker (query params `wyear` and `wquarter`, default the current quarter, independent of the page's period), a "Received" table (payor, ATC rows with income and tax withheld, certificates) with quarter totals per currency, a separate "Still waiting for 2307" list, a "Download CSV" link to `/reports/csv?report=withholding&year=<y>&quarter=<q>`, and an empty state.

- [x] **Step 1: Write the failing component tests:** both lists render, totals per currency, the waiting list is not part of the totals, CSV link href, empty state.
- [x] **Step 2: Run** `npx vitest run --project components src/app/(app)/reports` on the Linux copy. Expected: FAIL.
- [x] **Step 3: Implement** the section as a server component; on a phone rows become cards.
- [x] **Step 4: Run again.** Expected: PASS. `npx tsc --noEmit`, `npx eslint`.

### Task 12: End to end, accessibility, docs, full verification

**Files:**
- Create: `e2e/withholding.spec.ts`
- Modify: `DESIGN.md` (badges, Withholding page, certificate form, report section), `docs/compliance/processing-register.md` (payor TIN, name and address on 2307 certificates, and their scans), and `docs/compliance/ph-e-invoicing.md` where it describes withholding (it mentions it; keep it consistent)

- [x] **Step 1: Write the e2e spec** (desktop; mobile for the read-only checks), using the billing statement and payment helpers from `e2e/invoices.spec.ts` with made-up data: record a payment with tax withheld, see "2307 pending" on the Payments list; open Withholding (2307), choose "Record 2307" from the waiting row, fill the form with the ATC `WI160`, a PDF scan generated in the test, and the pre-ticked payment; save; see "2307 received" and the certificate page; open Reports, pick the quarter, see the payor, and download the CSV and assert its header row and one data row; void the certificate with a reason and see the payment pending again. Run axe (WCAG 2.2 AA) on the Withholding page, the form and the certificate page in light and dark, and check no horizontal overflow at 360px.
- [x] **Step 2: Run** `npx playwright test e2e/withholding.spec.ts` (user runs). Fix what fails in the code, not the test.
- [x] **Step 3: Update the docs** as listed.
- [x] **Step 4: Run the whole verification:** on the Linux copy `npx tsc --noEmit`, `npx eslint .`, `npx vitest run --project unit --project components`; the user runs `npm run test:int` (in batches), then `npx playwright test`. Expected: all green, and `git status` shows only the files named in this plan plus the generated migration and its snapshot.
- [x] **Step 5: Report** the results to the user with a short summary and wait for confirmation. Production migration and any commit come only after the user's review.
