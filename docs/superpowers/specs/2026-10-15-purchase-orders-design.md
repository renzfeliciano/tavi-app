# Purchase orders — design (October 2026)

Status: written under the founder's standing "go ahead with the next phase" instruction; the four design questions were answered with the recommended options. Classified **architectural** (new tables, a new module, a new numbering kind, new permissions).

## Understanding

A Tavi business buys things from suppliers: stock, materials, a subcontractor's time. It wants a numbered **purchase order (PO)** it can print or email to the supplier, and a record of whether the goods arrived. Success: make a PO in under a minute, issue it, email or download it, mark it received. Said by the founder: we issue POs to suppliers; suppliers are a small separate list; life cycle is Draft → Issued → Received, or Cancelled; contents are line items with quantity, unit price and tax; PDF and email; **feeds nothing** (no stock, no bills, no reports, no customer link). Assumed: one currency per PO, tax mode from the business setting (as quotes), no public link, no supplier portal, no approvals.

## Decisions

| # | Decision | Why |
|---|---|---|
| P1 | New module `purchasing` owns `suppliers`, `purchase_orders`, `purchase_order_lines`. | One cohesive area; separate from sales documents, so quotes/invoices code is untouched. |
| P2 | Suppliers: name (required), contact person, email, phone, address (market fields), tax ID, notes. Archived, never deleted. No currency or category. | Same pattern as customers, smaller. POs keep a snapshot, so edits never change an issued PO. |
| P3 | PO numbers: a new numbering kind `purchase_order`, default prefix `PO-`, padding 6, allocated by `allocateDocumentNumber` inside the issuing transaction. A migration widens `document_sequences_kind`. The numbering settings screen lists it. | Same series rules as quotes/invoices/receipts. |
| P4 | Status: `DRAFT → ISSUED → RECEIVED`; `ISSUED → CANCELLED`. Drafts are edited with explicit Save (no autosave) and deleted outright (confirm dialog). Issued POs are not editable: cancel and make a new one. | Smallest life cycle that is honest about what was sent. |
| P5 | Lines reuse `parseDocumentLines`, `calculateDocument`, `LineItemsEditor` and the document summary. Header (supplier, currency, order date, expected date, notes, terms) has its own parser, because the shared one speaks of customers and requires a second date. Expected date is optional. | Money math stays in one function (§B.2). |
| P6 | Issuing: needs a supplier, at least one line and a verified email address. It allocates the number, freezes the supplier snapshot and the seller snapshot (D25), sets `issued_at`. Emailing is optional at issue and can be done later from the PO. | As quotes. |
| P7 | Receiving: "Mark received" asks for the date received (default today in the business's time zone, not in the future, not before the order date) and an optional note. No partial receipts. | YAGNI; the founder said feeds nothing. |
| P8 | Cancelling an issued PO needs a reason (dialog, up to 500 characters); the PDF then prints "Cancelled". | Destructive: asks first. |
| P9 | Email: details only, no attachment (as receipts); the sender downloads the PDF separately. Goes through `enqueueEmail` and `flushOutboxAfterResponse`, counts toward the existing daily document-email limit. Reply-to is the business. | Same ruling as receipts. |
| P10 | PDF: same layout engine (`DocumentPdf`) with the party labelled "Order to" (supplier). Title from the market (`documents.purchaseOrder`); PH: "Purchase order". Prints the market's supplementary-document notice (D13) so a PO is never mistaken for an invoice. | D12: no hard-coded wording. D13. |
| P11 | Permissions: `purchasing.read`, `purchasing.write` (suppliers and drafts), `purchasing.issue` (issue, email, receive, cancel). All three are everyday capabilities (member, admin, owner). | Buying is daily work, like quotes. |
| P12 | Audit actions: `supplier.created`, `supplier.updated`, `supplier.archived`, `supplier.restored`, `purchase_order.created`, `purchase_order.issued`, `purchase_order.emailed`, `purchase_order.received`, `purchase_order.cancelled`, `purchase_order.deleted`. Written in the same transaction. | House rule. |
| P13 | Privacy (D15/D16): suppliers hold names, emails, phones and addresses of people at other businesses. Add the three tables to the privacy export and to account closure, to the processing register, and to the Privacy Notice's list of what we store. No `LEGAL.version` bump (no new purpose, no new provider). | Same ruling as receipts. |
| P14 | Navigation: "Purchase orders" row in the sidebar (first under Manage, the row after Payments; it is buying, not selling); "Suppliers" link in the PO list header; "New purchase order" in the New menu. `/purchase-orders` and `/suppliers` added to `PROTECTED_PREFIXES`. | Suppliers are secondary, so no sidebar row of their own. |

## Data

`suppliers`: `id`, `organization_id`, `display_name`, `contact_name`, `email`, `phone`, `address_line1/2`, `city`, `region`, `postal_code`, `tax_id`, `notes`, `archived_at`, timestamps. Unique `(organization_id, id)`; index on `(organization_id, lower(display_name), id)`; check name not blank.

`purchase_orders`: `id`, `organization_id`, `supplier_id` (composite FK), `number` (null until issued; unique per organization), `status`, `currency`, `tax_mode`, `order_date`, `expected_date` (nullable, not before order date), `supplier_snapshot`, `seller_snapshot`, `notes`, `terms`, totals (subtotal, discount, tax, total; not negative), `issued_at`, `received_at`, `received_date`, `receipt_note`, `cancelled_at`, `cancel_reason`, `created_by`, timestamps. Check: once issued, supplier and number exist (as `quotes_sent_complete`).

`purchase_order_lines`: the same columns as `quote_lines` (position, description, unit, quantity, unit price, discount, tax-rate snapshot, line amounts), composite FK to the PO with cascade.

## Screens

- **Purchase orders list** (`/purchase-orders`, route group `(list)`): DataTable per the standing rules (fixed-height panel, pagination, page size, count, debounced search by number or supplier, status filter), **no summary strip** (any total of open or received value would imply the feature feeds something). Header actions: Suppliers, New purchase order. Empty state explains in one line.
- **New / edit draft** (`/purchase-orders/new`, `/purchase-orders/[id]/edit`): one form. Supplier combobox (async search, with "Add a supplier" link), currency, order date, expected date, line editor, notes, terms, live totals. Buttons: Save draft, Issue. Skeleton matches.
- **PO view** (`/purchase-orders/[id]/(view)`): the paper, status line (icon + label), actions by status: Edit/Delete (draft), Email/Download/Mark received/Cancel (issued), Download (received, cancelled).
- **PDF** (`/purchase-orders/[id]/pdf`): issued, received and cancelled orders only. A draft has no number or frozen details, so its PDF answers 404 ("Issue the purchase order to download it.").
- **Suppliers** (`/suppliers` list, `/suppliers/new`, `/suppliers/[id]` edit + archive/restore). List follows the table rules.

Every page has a `loading.tsx` in its real layout; list pages are registered in `loading-states.test.tsx`. Every text field has an `eg()` example from the market profile (`examples.person`, `examples.company`, address and tax-ID examples already in the market).

## Market profile (D12)

`MarketProfile.documents.purchaseOrder: { singular; plural }` (PH: "Purchase order" / "Purchase orders"). The "Order to" label and status words are neutral UI copy, not market data.

## Errors and edge cases

- Archived supplier: usable on a draft that already has it; not choosable on a new one (same rule as customers).
- Draft with no lines or supplier can be saved; Issue says what is missing, field by field.
- Totals too large for the calculation: "This purchase order is too large to total. Split it into smaller ones." (as quotes).
- Issuing twice (two tabs) or receiving a cancelled PO: the second action gets a clear message, not a crash (row lock, status re-checked in the transaction).
- Idempotent issue is not needed: issue is a status transition under lock; a repeat finds it no longer a draft.
- Supplier without an email: Email is disabled with the reason beside it; the PO can still be downloaded.

## Testing

Domain (pure): status transitions, draft parser (limits, dates, supplier id), supplier input, receive-date rules, PO view model. Integration: suppliers CRUD and tenant isolation; save/issue/receive/cancel/delete; numbering sequence per organization; audit rows; email outbox row; privacy export includes the tables; closure removes them. Component: forms, dialogs, list columns. E2E: add a supplier, make a PO, issue, download PDF, mark received; a member can do it; loading skeleton matches the page. Existing counts that change (primary nav, New menu, numbering kinds) are updated deliberately.

## Out of scope

Stock, supplier bills, payments to suppliers, partial receipts, revisions, approvals, a supplier portal or public link, attachments, reports, a PO line picker from the catalog, recycle-bin support for deleted drafts (deferred: drafts are deleted after a confirm dialog).
