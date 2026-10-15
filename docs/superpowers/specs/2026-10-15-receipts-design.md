# Collection and acknowledgement receipts: design

Phase 2 item chosen by the founder (October 2026). Status: **draft for review**. Nothing here is built yet.

## 1. Purpose

Tavi already gives a payment acknowledgement, but only when money is paid against an invoice. A business also receives money that is not a sale: a reimbursement from a staff member, a deposit, an advance, a refund from a supplier, a collection made for someone else. Today it writes these receipts by hand in a booklet. This design lets a business make a numbered **Collection Receipt** or **Acknowledgement Receipt** for any money received, with no invoice involved.

Success looks like this:

- From the New menu or the Payments page, a person fills one short form (who paid, how much, what for) and gets a numbered receipt at once.
- The receipt can be downloaded as a PDF and emailed to the payer.
- A mistake is voided with a reason. The number is never reused and never edited.
- These receipts never change an invoice balance, a sales figure, the dashboard totals or a Form 2307 figure.

## 2. Decisions

From the founder's answers (October 2026) unless marked **assumed**. The founder was away for the last decisions and asked for the recommended choice each time; those are marked **recommended**.

- **One document, two titles** (founder). Collection Receipt and Acknowledgement Receipt are the same form; the person picks the title on each receipt. Titles are named in the market profile (D12), not in code.
- **Payer: a customer, or anyone typed in** (founder). A receipt can point at an existing customer or carry a typed name for a one-off payer. A typed name is not added to the customers list. The name is copied onto the receipt, so renaming the customer later does not change a receipt already given.
- **Issued straight away, void if wrong** (founder). No draft stage and no editing. Saving gives the number and writes the audit event in one transaction.
- **Same number series as payment acknowledgements** (founder). Every receipt Tavi gives, from an invoice payment or not, takes the next `REC-` number from the one receipt series, so the run has no gaps.
- **Separate table, same module** (recommended). A new `receipts` table in the `payments` module. `payments.invoice_id` stays required. This keeps invoice balances, settled amounts and Form 2307 queries untouched.
- **Seller details are frozen at issue** (assumed, following D25). The business's registered name, TIN statement and address are copied onto the receipt as an invoice does, so a later change to the business profile does not alter a receipt already given.
- **Received for** (assumed). A required short line (up to 120 characters), such as "Reimbursement of fuel" or "Deposit for event". Optional notes below it (up to 2,000 characters).
- **Payment details are the same as payments** (assumed). Method, reference, bank or wallet, time, and the cheque's own date, with the same labels the market profile gives them. Cash needs none.
- **Amount** (assumed). One amount in the business's currency, above zero, no withheld-tax field (withholding belongs to invoice payments). The date received cannot be in the future.
- **Who** (assumed): anyone who can record payments (`payments.record`) issues a receipt, anyone with `payments.void` voids one, and `payments.read` views them. No new permissions.
- **Email** (recommended). The same optional email as a payment acknowledgement: up to 5 recipients, through the outbox, counted in the existing per-business email limit, checked before anything changes. A customer's email is offered as the default.
- **No public share link in v1** (founder chose the recommended option). A payer receives the PDF by email; there is no customer page for receipts.
- **Not counted anywhere as sales or payments** (recommended). The invoice payments list, the dashboard, the Reports and the CSVs are unchanged. Receipts have their own list.
- **Notice** (assumed). Receipts are supplementary documents (D13): they print the market's supplementary-document notice in bold and "Not a BIR official receipt." from the market profile.
- **Reached from the Payments page and the New menu, not the sidebar** (recommended). The sidebar's Sales group is already four rows tall and the 730 px window only just fits. The Payments page header gets a "Receipts" link and a tab, and the New menu gets "New receipt".

## 3. Out of scope

- A public link or portal page for the payer.
- Editing a receipt, linking one to an invoice, or turning one into a payment.
- Deleting a voided receipt to the recycle bin (the owner-delete feature for payments can be extended later).
- Reports or CSV of receipts (the data download includes them; see 8).
- Receipts that contain several lines or items, tax breakdowns, or a printed signature of the payer.
- Registered official receipts under BIR rules. Tavi's receipts stay supplementary documents until the RDO/CPA questionnaire is answered.

## 4. Data model (migration 0035)

### `receipts` (owned by `payments`, in `schema.ts`)

| column | type | notes |
|---|---|---|
| id | uuid | primary key |
| organization_id | uuid | required, cascade on organization delete |
| title | text | `collection` or `acknowledgement`; check constraint |
| receipt_number | text | required; unique per organization; allocated from the receipt series |
| customer_id | uuid | optional; composite FK `(organization_id, customer_id)` to customers |
| payer_name | text | required, up to 200 characters; printed name |
| amount_minor | bigint | above zero |
| currency | char(3) | ISO |
| received_on | date | not in the future (checked in the use case) |
| method | text | same `PAYMENT_METHODS` as payments |
| reference, institution | text | optional |
| paid_time | text | optional `HH:MM`, same check as payments |
| cheque_date | date | optional |
| purpose | text | required, up to 120 characters |
| notes | text | optional |
| seller | jsonb | the seller block copied at issue |
| idempotency_key | text | unique per organization, so a double submit finds the same receipt |
| issued_by | uuid | user, set null on delete |
| voided_at, void_reason, voided_by | | a void needs a reason (check constraint) |
| created_at, updated_at | | standard |

Indexes: `(organization_id, received_on desc)`, `(customer_id)`. Never deleted by the application.

## 5. Use cases (`payments` module, `application/receipts.ts`)

- `issueReceipt(actor, input, options)`: needs `payments.record`; checks the input (`parseReceiptInput`, pure, in `domain/`); in one transaction takes the next number with `allocateDocumentNumber` for kind `receipt`, inserts the row with the seller snapshot, audits `receipt.issued`, and queues the optional email. A repeat of the same idempotency key returns the receipt already made. A customer from another business, or an archived one, is refused.
- `voidReceipt(actor, id, reason)`: needs `payments.void`; reason required (up to 500 characters, `MAX_REASON`); audits `receipt.voided`; voiding twice is refused with a plain message.
- `getReceipt`, `listReceipts` (search by number, payer or purpose; views All, Collection, Acknowledgement, Voided; page and size as the standing table rule), both needing `payments.read` and scoped to the actor's organization.
- Audit actions `receipt.issued` and `receipt.voided` are added to `AUDIT_ACTIONS`.

## 6. Screens

- `/receipts`: list in the standard `DataTable` (fixed-height panel, sticky header, pagination, size, count, debounced search). Columns: number, date, payer, for, title, amount, status. Empty state: "No receipts yet".
- `/receipts/new`: one short form: title, payer (customer picker with "Someone else" typing), amount, date received, method with its details, received for, notes, and the optional "Email a copy" recipients. Success toast "Receipt REC-000124 made." and the person lands on the receipt.
- `/receipts/[id]`: the paper (same look as the payment acknowledgement), PDF download, "Email a copy" for a receipt not yet sent, and Void with a reason dialog (voided receipts show a clear "Voided" stamp and the reason).
- `/receipts/[id]/pdf`: attachment with an ASCII file name, `private, no-store`.
- Each page has its own `loading.tsx` skeleton in its real layout. `/receipts` is added to `PROTECTED_PREFIXES`.
- The shared acknowledgement paper and PDF are given a small view-model for "a receipt with no invoice", so web and PDF stay one drawing.

## 7. Copy and market profile (D12)

The titles ("Collection receipt", "Acknowledgement receipt"), the notice, the "Received for" label and its examples come from the market profile (`documents.receiptKinds` and existing notice fields), with PH values. Examples in empty fields use `eg()`.

## 8. Privacy, audit, export

- Typed payer names may belong to people who are not customers (staff, suppliers). The processing register (P4) lists `receipts`, and the Privacy Notice names "payers named on receipts". **Assumed: no `LEGAL.version` bump**, because payer names on payments were already processed for the business; this is a legal call for the founder and the CPA (see 10).
- `receipts` is added to the privacy export (D16) with a note.
- No bulk job acts on receipts, so closed businesses need no special case. Deleting a business removes its receipts.
- Every issue and void is audited inside the same transaction.

## 9. Tests

- Unit: `parseReceiptInput` (amount, future date, lengths, method details, titles, recipients), the receipt view-model, the market-profile titles.
- Integration (real Postgres): issue gives the next `REC-` number and the same series as payments (a payment and a receipt in turn give consecutive numbers); idempotent repeat; void with reason; double void refused; another business's customer refused; tenant isolation on get and list; invoice balances, `settled` amounts and payments list unchanged by a receipt; export includes receipts.
- Component: the form (typed payer vs customer, method details, errors), the void dialog, the list.
- E2E: make a receipt for a typed payer, download its PDF, email it, void it, and see it in the list on desktop and mobile; skeletons match the pages; axe checks pass.

## 10. Open questions for the founder

1. **Privacy version bump:** is naming non-customer payers on receipts a material change that needs a new terms version and a fresh acceptance? The design assumes no. A CPA or lawyer should confirm.
2. **Sidebar:** receipts are reached from Payments and the New menu. If you want a sidebar row, the Sales group grows to five and the short-window rows get tighter again.
3. **Official receipts:** if the RDO says Tavi may issue registered official receipts later, these supplementary receipts would need a second mode like invoice mode. Not planned.
