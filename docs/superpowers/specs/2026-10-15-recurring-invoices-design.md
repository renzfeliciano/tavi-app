# Recurring billing statements: design

Phase 2 item chosen by the founder. Status: **draft for review**. Nothing here is built yet.

## 1. Purpose

Some customers are billed the same thing every week, month, quarter or year (a retainer, a maintenance contract, a rent-style fee). Today the business copies last period's statement by hand. This design lets a business repeat a billing statement on a schedule and gets Tavi to prepare each new draft on the due date.

Success looks like this:

- On any issued billing statement the owner or an admin taps **Repeat this**, picks how often and when it starts, and a schedule exists.
- On each due date Tavi creates a **draft** with the same customer, lines and terms, and tells the business there is a draft to review.
- Nothing reaches a customer until a person reviews and sends the draft. Numbers are allocated only when it is issued, so numbering stays unbroken (BIR rules, D13).
- A paused, ended or deleted schedule creates nothing more.

## 2. Decisions

These come from the founder's answers (October 2026) unless marked as assumed.

- **A draft, not an automatic send** (founder). Each due date makes a draft for review. Automatic issue-and-email is out of scope for v1; a later setting can add it per schedule.
- **Set up from an existing statement** (founder). A **Repeat this** button on a billing statement copies its customer, lines, tax settings, payment terms and notes into a schedule. There is no separate template form. The Recurring page lists, edits, pauses and ends schedules.
- **Schedules: weekly, monthly, quarterly, yearly** (founder). Monthly, quarterly and yearly schedules run on a day of the month; a day past the end of a short month runs on that month's last day (the 31st becomes the 28th, 29th or 30th). Weekly runs on a chosen weekday.
- **Who** (assumed, same as drafts today): anyone who can write invoices (`invoices.write`) creates and edits schedules and reviews the drafts. Only owners and admins delete a schedule's history (not applicable in v1; see 8).
- **The schedule holds its own copy of the lines** (assumed). Changing or deleting the original statement does not change the schedule. Prices and tax rates on a draft are those saved in the schedule, not today's catalog price, so the draft equals what the customer agreed to. The reviewer can edit the draft before sending.
- **End** (assumed): a schedule has an optional end date or a number of drafts, or runs until paused or ended.
- **Pause and resume** (assumed): paused schedules create nothing; resuming continues from the next due date after today and does not backfill.
- **Missed runs create one draft, not many** (assumed). If the daily job did not run for days, the next run creates a single draft for the latest due date and moves the schedule forward. A business is never handed a stack of back-dated drafts.
- **Dates on the draft**: the issue date is left for the reviewer (set when issued, as for any draft); the due date is the issue date plus the schedule's payment terms (days), kept from the original statement; a title note such as "June 2026" is not generated in v1.
- **Customer gone**: if the customer is archived or deleted the schedule pauses itself and says why.
- **Currency and market** come from the business, never hard-coded (D12).

## 3. Out of scope

Automatic issue and email, proration, usage-based amounts, price changes by percentage, reminders to the customer, invoices (BIR-registered mode) beyond what a draft already supports, schedules for quotations, and subscription billing for Tavi itself.

## 4. Data model (migration 0034)

All tables carry `organization_id` and use the shared `id()` and `timestamps()` helpers; money is `bigint` minor units. Cross-table foreign keys in the same organization are composite `(organization_id, id)`.

### `recurring_schedules`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| organization_id | uuid not null | cascade |
| customer_id | uuid not null | composite FK to customers |
| source_invoice_id | uuid | the statement it was made from; set null if that statement is removed; for display only |
| frequency | text not null | check in `weekly`, `monthly`, `quarterly`, `yearly` |
| anchor_day | smallint not null | day of month 1 to 31, or weekday 1 to 7 for weekly |
| anchor_month | smallint | 1 to 12, yearly only |
| next_run_on | date not null | the next due date, in the business's time zone |
| ends_on | date | optional |
| max_drafts | integer | optional; counts down against `drafts_created` |
| drafts_created | integer not null default 0 | |
| status | text not null | check in `active`, `paused`, `ended` |
| pause_reason | text | set when Tavi pauses it (customer gone) |
| terms_days | integer | payment terms copied from the source |
| currency, notes, tax settings | as on `invoices` | copied from the source |
| last_run_on | date | for idempotency |

### `recurring_schedule_lines`

The same shape as invoice draft lines (description, quantity, unit price in minor units, tax rate snapshot, optional product link), keyed by `schedule_id`. Calculation uses the one calculation function (§B.2); no totals are stored in the schedule.

### Link from a draft back to its schedule

`invoices.recurring_schedule_id` (nullable, set null on delete) and `invoices.recurring_for_date` (date). A unique index on `(recurring_schedule_id, recurring_for_date)` makes the daily job idempotent: running it twice, or two runs overlapping, can never create a second draft for the same due date.

## 5. Use cases (`invoices` module, `application/recurring.ts`)

- `createSchedule(actor, sourceInvoiceId, input)`: needs `invoices.write`; copies the source's customer, lines and terms; computes `next_run_on` on or after the chosen start date; audit `recurring.created`.
- `updateSchedule`, `pauseSchedule`, `resumeSchedule`, `endSchedule`: each audited in the same transaction; `endSchedule` sets status `ended`.
- `runDueSchedules(organizationId, today)`: for each active schedule with `next_run_on <= today`, in one transaction per schedule: lock the row, insert the draft invoice from the schedule (same writer as `saveInvoiceDraft`), set the link columns, advance `next_run_on` to the next due date after `today`, increment `drafts_created`, end the schedule when `ends_on` or `max_drafts` is reached, audit `recurring.draft_created`. The unique index turns a repeat into a no-op.
- Next-date arithmetic is pure code in `domain/recurrence.ts` (month ends, leap years, quarter and yearly anchors) and is tested first.

## 6. The daily job

`/api/cron/daily` already runs once a day per the businesses' own time zones. It gains one call per business: `runDueSchedules(organizationId, today)`, inside the existing per-business `try`, so one business's failure never stops the others. Its result adds `recurringDrafts` to the logged and returned counts. A late or doubled run is harmless (see the unique index).

## 7. Screens

- **Billing statement page**: a **Repeat this** button (not on drafts) opens a short dialog: how often, the day, the start date, optional end. A toast says "Repeating every month from 1 Nov 2026. View schedule" with a link.
- **Recurring page** (`/recurring`, added to `PROTECTED_PREFIXES` and the navigation under Billing): a `DataTable` of schedules with customer, what it repeats (amount from the lines), frequency, next run, drafts created and status; pause, resume and end from each row's page. Skeleton matches the layout (`loading.tsx`).
- **Schedule page**: the lines and terms as saved, the drafts it has made (links), and Edit, Pause, End. Edits apply to future drafts only.
- **Drafts**: a draft made by a schedule shows "From a recurring schedule" with a link, so the reviewer knows why it exists.
- **Dashboard and the Stamp**: the "needs attention" list counts drafts waiting from schedules ("2 recurring drafts to review"), real data only.
- Carbon Copy design, semantic tokens only, no entrance animation. Feedback rules apply (toasts; a dialog before ending a schedule).

## 8. Privacy, audit, trash

- New audit actions: `recurring.created`, `recurring.updated`, `recurring.paused`, `recurring.resumed`, `recurring.ended`, `recurring.draft_created`.
- Schedules hold customer and price data already held elsewhere; the privacy export gets the two new tables (D16), the processing register a line, and the Privacy Notice needs no new purpose (same data, same purpose). No tracking, no new service provider.
- Schedules are ended, not deleted, in v1 (like a void: the history stays). A draft a schedule made is an ordinary draft: it can be deleted into the recycle bin and the schedule carries on.
- The closed-business rule: the daily job skips closed businesses (`organizations.closed_at`).

## 9. Tests

- Domain (first): next-date arithmetic for each frequency, month ends and leap years, anchor days past a month's end, ends-on and max-drafts, "one draft for a long gap".
- Integration: create from a statement; a due schedule makes exactly one draft with the saved lines and terms; a second run makes none; a gap makes one draft; pause, resume, end; customer archived pauses with a reason; numbers are not allocated until issue; role refusal; audit rows in the same transaction; export includes the tables; closed businesses skipped.
- Component: the Repeat dialog and the schedule rows.
- E2E: repeat a statement, run the due job against the test database, see the draft and the dashboard count; a member without write access cannot create a schedule; skeleton-vs-page for the Recurring list and schedule page.

## 10. Open questions for the founder

None blocking. Two choices were assumed above and are easy to change before building: the schedule keeps its own line prices (rather than refreshing from the catalog), and a long gap creates one draft (rather than one per missed period).
