# Withholding-tax certificates (BIR Form 2307): design

Payments step #13. Status: **draft for review**. Nothing here is built yet.

## 1. Purpose

Philippine customers often withhold creditable tax when they pay, and send the business a BIR Form 2307 weeks later. Tavi already records the withheld amount on a payment (`payments.withheld_minor`), and it already counts toward the billing statement's balance. This design adds what is missing: a record of the certificate itself, so the business can see which withholding it is still waiting on, keep the scan, and report the credit by quarter and payor.

Success looks like this:

- Recording a payment with tax withheld makes it show "2307 pending" with no extra step.
- When the 2307 arrives, the business records it once (typing what the form says, attaching the scan, ticking the payments it covers) and those payments show "2307 received".
- The business can open Reports, choose a quarter, and see creditable tax by payor and ATC, what it is still waiting on, and download both as CSV.
- Phase 5B's Cash Receipts Journal can read gross, cash received and withheld per payment without new work here.

## 2. Out of scope

Filing forms (1601-EQ, 2550, annual return), e-filing, reading scans (OCR), reminders or emails asking customers for a 2307, a complete ATC reference list (see 9), and the Cash Receipts Journal itself (Phase 5B).

## 3. Decisions already made

- **"2307 pending" is derived, not stored.** A payment with `withheld_minor > 0` and no certificate linked is pending; with a certificate linked it is received. Certificates exist only once the form has arrived.
- **A certificate has 1 to 5 rows** (the form's table), each with its own ATC and rate.
- **ATC and rate are data.** No rate is hard-coded in logic; the market profile only supplies suggestions.
- **No silent deletes.** A mistaken certificate is voided with a reason and stays visible, like a payment.

## 4. Data model (migration 0030)

All money is `bigint` minor units. All tables carry `organization_id` and use the shared `id()` and `timestamps()` column helpers. Foreign keys that cross tables in the same organization are composite `(organization_id, id)`, as `payments` does for invoices.

### `withholding_certificates`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| organization_id | uuid not null | cascade |
| customer_id | uuid not null | the payor; composite FK to customers |
| payor_tin | text not null | as written on the form, at most 20 characters, at least 9 digits |
| payor_name | text not null | |
| payor_address | text | one line, as written on the form |
| period_from, period_to | date not null | |
| received_on | date not null | when the certificate arrived |
| currency | char(3) not null | must equal the linked payments' currency |
| file_id | uuid | the scan; FK to `files`, set null on delete |
| notes | text | |
| created_by | uuid | set null on user delete |
| voided_at, void_reason, voided_by | | void reason required when voided |
| created_at, updated_at | | |

Checks: `period_from <= period_to`; both dates fall in the same calendar quarter (`date_trunc('quarter', period_from) = date_trunc('quarter', period_to)`); `void_reason` present when `voided_at` is set. Unique `(organization_id, id)`. Index `(organization_id, period_from desc)`.

### `withholding_certificate_lines`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| organization_id, certificate_id | uuid not null | composite FK, cascade |
| position | smallint not null | 1 to 5; unique with certificate_id |
| atc_code | text not null | upper-case letters and digits, at most 10 |
| description | text | nature of the income payment, at most 120 |
| rate_bps | integer not null | 1 to 10000 (0.01% to 100%); 200 means 2.00% |
| month1_minor, month2_minor, month3_minor | bigint not null | income payments in the 1st, 2nd and 3rd month of the quarter; at least 0 |
| total_minor | bigint not null | check: equals the three months added, and is above 0 |
| tax_withheld_minor | bigint not null | as printed on the form; above 0 and not more than `total_minor` |

### `withholding_certificate_payments`

| Column | Type | Notes |
| --- | --- | --- |
| organization_id | uuid not null | |
| certificate_id | uuid not null | composite FK to certificates |
| payment_id | uuid not null | composite FK to payments |

Primary key `(certificate_id, payment_id)`. **Unique `(payment_id)`**: a payment sits under at most one certificate. Billing statements are reached through their payments; there is no separate statement link.

### Files

`files.purpose` gains `withholding_certificate`; the `files_purpose` and `files_purpose_shape` checks are extended (this purpose needs `file_name` and no `doc_kind`). Same 2 MiB limit and PDF, PNG, JPG and WebP types as registration documents. These scans do **not** count toward the 8-document registration limit. A replaced scan is deleted; a voided certificate keeps its scan.

### No backfill

Existing payments with tax withheld simply show "2307 pending" until a certificate is linked. That is the correct state for them.

## 5. Rules

### Status of a payment

`none` when `withheld_minor = 0`; `received` when a link row exists; otherwise `pending`. Voided payments have no status.

### Linking (checked in the use case, inside the transaction, on create and on every edit)

Each payment must: belong to the same organization; belong to a billing statement of the certificate's customer; be active (not voided); have `withheld_minor > 0`; have the certificate's currency; have `paid_on` between `period_from` and `period_to`; and not be linked to another certificate. A payment may not be linked twice to the same certificate.

### Reconciliation (informational, never blocks)

`certificate total` is the sum of line `tax_withheld_minor`. `linked total` is the sum of `withheld_minor` over linked payments. The difference is shown as "Matches" or "Differs by ₱X". A certificate may legitimately include payments made outside Tavi, so it can be saved with no links or with a difference.

### Tax calculation

The form suggests `tax = round(total × rate_bps / 10000)`, half up, in integer arithmetic. It is only a default: the saved value is what the person types, so it can match the printed form exactly.

### Voiding

`voidCertificate` requires a reason, sets the void columns, deletes the certificate's link rows (so those payments are pending again) and records an audit event that lists the unlinked payment ids, all in one transaction. A voided certificate is read-only, stays in the list under a "Voided" filter, and is excluded from the report.

### Voiding a payment that is linked

The existing payment void use case also deletes that payment's link row in the same transaction and audits it. The certificate then shows a difference on its next view.

### Editing

An active certificate's header, rows, scan and links can be edited. The customer cannot change. Each edit writes an audit event with a before/after summary.

## 6. Application layer

All new code lives in the payments module (`@/modules/payments`, with a `/client` entry for pure domain code). The scan upload goes through the files module's public API. Audit events are recorded inside the same transaction as the change.

- `recordCertificate`, `updateCertificate` (permission `payments.record`)
- `voidCertificate` (`payments.void`)
- `getCertificate` (header, rows, linked payments with their billing statement numbers, reconciliation, scan metadata), `listCertificates` (filters: year, quarter, customer, voided), `listPendingByCustomer`, `pendingPaymentsForCustomer(customerId, period)`, `paymentWithholdingStatus(paymentIds)`, `withholdingReport(year, quarter)` (`payments.read`)
- `withholdingForPayments(paymentIds)`: gross, cash received, withheld and certificate status per payment, for the Phase 5B Cash Receipts Journal
- Domain (pure, unit-tested): `quarterBounds`, `monthOfQuarter`, `defaultTaxWithheld`, certificate input parsing and validation, `reconcile`
- Files: `uploadWithholdingScan`, `removeFile`; `readOrganizationFile` and `/api/files/[id]` serve the new purpose to people with `payments.read`

## 7. Interface

Mobile first, no horizontal scrolling, light and dark, visible focus, `cursor-pointer` on interactive elements, a Back button on every sub-page, and a `loading.tsx` per route. Typed routes use `as Route`.

- **Badges.** The Payments list, the payment page and a billing statement's payment list show "2307 pending" or "2307 received" beside any payment with tax withheld. The Payments list gets a "2307 pending" filter.
- **Payments, Withholding (2307)** at `/payments/withholding`, reached from a link in the Payments page header (no new sidebar item). Two sections: "Waiting for a 2307" (grouped by customer: number of payments, tax withheld, oldest payment date, a "Record 2307" button) and "Received" (payor, quarter, ATC, tax withheld, scan icon, "Matches" or "Differs"; a "Voided" filter). Empty states explain what a 2307 is in one line.
- **Record 2307** at `/payments/withholding/new?customer=<id>`: a full page. Fields: customer (the payor), TIN (prefilled from the customer's tax ID when present), name and address (prefilled from the customer), year and quarter (sets the period), received on, 1 to 5 rows (ATC from the suggestions or "Other"; rate; the three month amounts labelled with the real month names; total and tax withheld calculated and editable), the scan, notes, and the customer's pending payments in the period, ticked by default, with a live total and the matches/differs line.
- **Certificate page** at `/payments/withholding/[id]`: a paper-like summary of the form, the scan (open or download), linked payments and billing statements as links, Edit, and Void (a modal with a reason; concerned mascot, danger tone).
- Wording comes from the market profile. Nothing suggests leaving income out of reporting.

## 8. Reports

Reports gets a section "Creditable tax withheld (2307)" with a year and quarter picker (current quarter by default).

- **Received**, grouped by payor (normalised TIN digits; the name from the latest certificate), then by ATC: income payments, tax withheld, number of certificates; quarter totals per currency. Quarter means the calendar quarter of `period_from`. Voided certificates are excluded.
- **Still waiting for 2307**, by customer: payments with tax withheld and no certificate whose `paid_on` is in the quarter. Shown separately; never added to the received totals.
- **CSV** (existing report CSV helper, with its formula-injection guard): one row per certificate row, then one row per pending payment. Columns: Quarter, Status (`Received` or `Pending`), Payor TIN, Payor name, Received on, ATC, Rate %, Month 1, Month 2, Month 3, Total income payments, Tax withheld, Billing statements, Has scan. Pending rows leave ATC, rate, months and total blank and show the payment's withheld amount.

## 9. Market profile and wording

`MarketProfile` gains `withholdingAtcs: readonly { code: string; rateBps: number }[]`. The feature is on when the market's existing `taxWithheld` is not null. The PH profile ships with **only** the ATC and rate from the sample certificate (WI160, 200 bps) plus the "Other (type the code and rate)" choice. A fuller list is added only once the CPA confirms it (Phase 7, question 8). The certificate's name ("BIR Form 2307") already comes from `taxWithheld.label`.

## 10. Privacy and documents

The payor's TIN, name and address are stored; add them to `docs/compliance/processing-register.md`. Update `DESIGN.md` (badges, the Withholding page, the certificate form) and `docs/compliance/ph-e-invoicing.md` only if it mentions withholding.

## 11. Tests

- **Unit:** quarter bounds and month labels; tax rounding (half up, zero, large amounts); input validation (TIN length, row count, month sums, tax above total, period across a quarter); reconciliation; status derivation.
- **Integration (test branch):** record with links; each link rule fails correctly (other customer, voided payment, outside the period, other currency, already linked, no withheld amount); void unlinks and makes payments pending again; voiding a linked payment removes its link; edit audits before/after; organization isolation; permissions per action; scan purpose and size limits and that registration limits are not affected; report grouping, quarter edges and exclusion of voided certificates; CSV columns and the formula-injection guard.
- **Component:** the form (row add/remove, calculated tax then edited, live reconciliation, errors), badges, empty states.
- **E2E (desktop and phone, test branch, made-up data):** record a payment with tax withheld, see "2307 pending", record the 2307 with a scan, see "2307 received", open the report and download the CSV. Axe checks on the three new pages in light and dark.

## 12. Assumptions to confirm

1. A certificate's period sits inside one calendar quarter.
2. The CSV includes pending rows, flagged `Pending`.
3. Tax withheld can be edited to match the printed form.
4. The payor TIN is required on a certificate (at least 9 digits).
5. The sample's ATC (WI160, 2%) is the only suggestion until the CPA confirms more.
6. Customers already have a free-text tax ID, so the TIN is prefilled from it but the certificate keeps its own copy as written on the form.
