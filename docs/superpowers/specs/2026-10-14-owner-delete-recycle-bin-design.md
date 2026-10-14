# Owner delete → recycle bin: design

Status: **interpretations stated, built test-first**. The founder asked: "the business owner should be able to delete records such as quotations, billing statements, etc., and it should go to the recycle bin."

## 1. Purpose

Today only never-issued drafts can be deleted (D27), and archived customers and catalog items sit in the bin page's "Archived" section. A business owner also needs to clear out records that are no longer wanted: a quotation that was sent, a payment entered by mistake, a 2307 recorded twice. Every delete must be undoable for 30 days, and it must not damage the books.

## 2. Decisions

- **Who.** One new capability, `records.delete`, held by the owner only (OWNERSHIP set). Admins and members keep today's draft delete (`invoices.write` / `quotes.write`).
- **What the owner can delete.**
  - **Quotations in any status**, including sent, approved, rejected, expired and cancelled. Blocked when the quotation has become a billing statement or invoice (`convertedInvoiceId` set or an invoice names it as source): that quotation is the paper trail for the bill, so it stays and can be cancelled instead.
  - **Billing statements and invoices until issued**: unchanged. A draft has no registered number and no payments, so the existing draft delete already covers it. An issued bill (registered number, or payments) is voided, never deleted; BIR numbering must stay unbroken.
  - **Payments, only after they are voided.** Voiding already puts the money back on the bill and takes the payment off any 2307. Deleting a live payment would change what a customer owes without a trace, so it is two steps: void with a reason, then delete.
  - **Withholding certificates (2307), only after they are voided**, for the same reason.
  - **Customers and catalog items** are already archived into the bin page ("Archived" section) and restorable; no change.
- **Same bin.** `trash_items` gains kinds `sent_quote`, `payment`, `certificate`, and a nullable `label` (document or receipt number) so the bin can say "Quotation QUO-000012" instead of "quotation draft". Retention (30 days), restore, discard and empty are unchanged. Discard and empty stay with `organization.manage`; restoring a new kind needs `records.delete`, so the bin only lists what the person may bring back.
- **Restore puts the record back exactly as it was**: same id, number, status, snapshots and dates. A quotation's share links were revoked when it was deleted and stay revoked; the owner makes a new link if needed.
- **Audit.** New actions `quote.deleted` (already exists, metadata marks a sent quote), `payment.deleted`, `payment.restored`, `withholding_certificate.deleted`, `withholding_certificate.restored`, written in the same transaction. The audit log keeps the numbers and totals even after the bin is emptied.
- **Scan of a deleted 2307.** The scan file is deleted with the certificate (so personal paperwork does not linger outside the bin's 30-day payload). Restoring brings the certificate back without its scan; the person attaches it again. The delete dialog says so.

## 3. Data (migration 0033)

- `trash_items_kind` check widened to `('invoice','quote','sent_quote','payment','certificate')`.
- `trash_items.label text` nullable.
- No other table changes: a deleted quote's lines cascade; a deleted payment has no dependants once voided (its certificate links were removed at void); a deleted certificate's lines and links cascade.

## 4. Payloads

- `sent_quote`: version 2 quote payload = every column of the quote row (dates as ISO strings) plus lines.
- `payment`: the payment row. Restore requires the billing statement to still exist; the payment returns **voided**.
- `certificate`: header and its 1 to 5 lines, without links (voiding already removed them) and without the scan. Restore requires the customer to exist.
- Restore fails softly ("Its customer is gone") rather than half-restoring; the item stays in the bin.

## 5. Screens

- Quote page: owner-only **Delete** on non-draft quotes, confirm dialog stating what happens, then a toast "Quotation QUO-… moved to the recycle bin" with **View recycle bin**. Hidden when converted.
- Payment page and certificate page: owner-only **Delete** once voided, same dialog and toast.
- Recycle bin page: new rows with their labels, restore dispatch per kind, and a restore message naming where the record went.
- Skeletons unchanged (no layout change on the lists); action rows on detail pages keep their skeleton shape.

## 6. Privacy and docs

Privacy export includes the new kinds; processing register and DESIGN.md Recycle bin bullet updated.

## 7. Tests

Policy matrix and snapshot; trash domain (kinds, capability, label); integration for each delete and restore (numbers kept, totals and lists, share links, converted block, void-first rule, audit, role refusal); component test for the dialogs; e2e for the owner flow and the member not seeing Delete.
