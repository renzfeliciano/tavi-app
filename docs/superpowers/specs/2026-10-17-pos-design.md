# POS module: design

Founder request (October 2026). Status: **draft for review**. Nothing here is built yet.

## 1. Purpose

Walk-in counter sales for small service businesses that also sell items. A cashier picks catalog items, takes payment (recorded only), and gets a numbered receipt in a few taps on a phone. POS is a module inside Tavi, always on, and never changes how invoicing works for service-only users.

Success: first item to receipt in under a minute on a phone; a retry or double-tap never makes two sales; a mistake is voided, never deleted; the data model can take BIR rules later without a data migration.

## 2. Decisions

From the founder's answers unless marked **assumed**.

- **Own sale record, own number** (founder). Sales live in `pos_sales` / `pos_sale_lines`. The cashier types the sale number (column `sale_number`, unique per business). Nothing is written to the `receipts` table or the `REC-` series, so existing receipt behavior and reports are unchanged. The receipt view and PDF reuse the existing receipt template and document engine.
- **Roles** (founder): `member` is the cashier, `admin` the manager. New capabilities only: `pos.sell`, `pos.read.own`, `pos.read.all`, `pos.void`, `pos.stock`, `pos.settings`. `member`: sell, own sales. `admin` and `owner`: everything. No existing capability or role changes.
- **Stock on the catalog** (founder): nullable `track_stock` and `stock_qty` on `products` (additive migration). Services cannot track stock. Every change is also a row in append-only `stock_movements`.
- **Totals** (founder): the server runs `calculateDocument` unchanged. Tavi's existing tax behavior applies as on a quote. The new `tax_*` columns exist but stay null in v1.
- **QR codes** (best fit; founder delegated): reuse `organizations.payment_qrs` (D26, up to 3 labelled codes, already drawn clean with `qrcode`). No new upload path or file store. POS settings choose which codes show at checkout; that choice is audited, and edits to the codes themselves are already audited under organization updates.
- **Share link** (best fit; founder delegated): a tokenized public page `/s/[token]` like `/i/[token]`: unguessable token, rate-limited, `no-store`, no login, added to `PORTAL_PATH_PATTERNS`. It shows the same receipt as on screen, plus a PDF route. "Copy link" in the app copies it. Voided sales show "Voided" on the shared page. **Assumed:** the token mechanics mirror the invoice link code; confirmed during planning.
- **Void** (founder): any time, with a reason, by `pos.void` only. Original record kept; stock reversed in the same transaction; shown in reports as voided.
- **Insufficient stock** (founder): the cashier is warned and must confirm. Stock never goes below 0 (`CHECK stock_qty >= 0`). After confirmation the stock is set to 0 and the shortfall is recorded in the movement's metadata.
- **Payment methods** (assumed): Cash, GCash, Maya, Bank Transfer, Other come from the market profile (D12), not code.
- **Receipt content** (assumed): exactly what Tavi's receipt template already prints, including the existing supplementary-document notice. POS adds no BIR text to customer-facing screens.
- **Always on** (founder): no feature flag. This replaces the earlier idea of a flagged module.

## 3. Out of scope

Payment gateways, card terminals, Bluetooth or hardware printing, barcode scanners, offline mode, automatic or BIR-sequenced numbering, BIR-registered receipts, multi-branch, tax computation, paid services, automatic purging.

## 4. Data model (migration 0040, additive)

All money is integer centavos with a currency code. Every table carries `organization_id`; every query filters on it.

- `pos_sales`: id, organization_id, `sale_number` (text, required), `idempotency_key`, customer_id (nullable = walk-in), payer snapshot name (nullable), status (`completed` | `voided`), subtotal / total minor, tendered and change minor (cash only), notes, cashier user id, seller snapshot (D25), share token, `voided_at`, `void_reason`, `voided_by`, created/updated, and nullable `tax_type`, `tax_rate_bps`, `tax_amount_minor`, `vat_classification`.
  - Unique `(organization_id, sale_number)`; unique `(organization_id, idempotency_key)`.
  - CHECK totals, tendered and change `>= 0`; tendered `>= total` when method is cash; void fields all set or all null.
  - Indexes: `(organization_id, created_at)`, `(organization_id, cashier_id, created_at)`, `(organization_id, status)`.
- `pos_sale_lines`: sale_id, organization_id, product_id, name and unit price snapshot, quantity (`> 0`), line total, notes, and the same nullable `tax_*` fields.
- `pos_sale_payments` (one row per sale in v1): method, reference (nullable). Partial unique index `(organization_id, method, reference) WHERE reference IS NOT NULL`.
- `stock_movements` (append-only, trigger blocks update and delete): product_id, organization_id, delta, reason (`sale` | `void` | `adjustment`), sale_id (nullable), actor, note, created_at.
- `pos_settings`: organization_id (unique), chosen QR ids (subset of `payment_qrs`), updated_by.
- `products`: `track_stock boolean not null default false`, `stock_qty integer` with `CHECK (stock_qty IS NULL OR stock_qty >= 0)` and `CHECK (track_stock = (stock_qty IS NOT NULL))`.

Retention: nothing is purged. The period is an open question (section 10).

## 5. Use cases (`src/modules/pos/application`)

Each starts with the caller's `requireOrgContext()` and `assertCan`, validates input with `zod`, and runs multi-step writes in one transaction with `recordAuditEvent(tx, …)`.

- `createSale`: validate the cart (ids belong to this business, quantities positive) → price from the catalog on the server → `calculateDocument` → check stock (return `needs_confirmation` with the short items unless `confirmShortStock` is set) → check cash tendered → insert the sale, lines and payment, decrement stock and write movements → audit. Insert-conflict on the idempotency key returns the existing sale. Duplicate `sale_number` or payment reference returns a field error.
- `voidSale(reason)`: lock the sale row, refuse if already voided, mark void, restore stock with `void` movements, audit.
- `adjustStock`, `getSale`, `listSales` (paginated; own vs all by capability), `dailySummary(date)` and `exportSalesCsv(date)` using `ctx.timezone` day boundaries, `getSettings` / `updateSettings`.
- `getPublicSale(token)` for the share page (read only, returns no personal data beyond what the receipt shows).
- Reports: `reports` module gets a POS section (count, total, voided count, by method) through `@/modules/pos`, not by importing its tables.

Audit actions added: `pos_sale.created`, `pos_sale.voided`, `pos_sale.link_created`, `pos_stock.adjusted`, `pos_settings.updated`. No customer personal data goes into logs.

## 6. Screens (`src/app/(app)/pos/…`, mobile first)

- **Sell**: large item tiles and search, quantity stepper, note, customer-or-walk-in picker, sticky total bar. The cart lives in client state and is kept on any error.
- **Checkout**: sale number (required, inline duplicate error), method chips, cash tendered with live change, reference for other methods, QR shown for the chosen codes. One submit button that disables while pending; the idempotency key is generated once per checkout.
- **Receipt**: on-screen view, copy link, download PDF.
- **Sales** (`DataTable`, own vs all), **Summary** (date picker, figures strip, by-method totals, list, CSV), **Stock** (adjust on a catalog item), **Settings** (QR choice and the BIR readiness notice, from one exported constant).
- Skeleton `loading.tsx` per page, `e.g.` placeholders via `eg()`, Stamp in empty states only, no landing page changes.

## 7. Security and quality

Business scoping server-side on every query; server-side validation; CSV cells that start with `= + - @` are neutralised; user text is escaped in receipts (React) and the PDF; new route folders are added to `PROTECTED_PREFIXES`; the share page is rate-limited and `no-store`. Errors are inline and specific. Structured `logger` events for sales, voids and errors.

## 8. Privacy and compliance bookkeeping

Walk-in sales hold no personal data. Sales to a customer reference the customer. Update the processing register and the data download for `pos_sales`, per CLAUDE.md. `LEGAL.version` is not bumped (assumed; confirm with a CPA or lawyer).

## 9. Tests (test-first)

Unit: totals and rounding through `calculateDocument`, change, stock decrement and void reversal, CSV neutralising. Integration (real Postgres): duplicate sale number, duplicate reference, idempotent retry, stock decrement and warning, void permissions, audit rows, append-only triggers, cross-business access fails. Manual checklist: sale to receipt, void, CSV export, QR settings flow, share link.

## 10. Open items and BIR checklist

- Retention period for sales, voids and audit records under BIR rules: open.
- Whether input-based numbering is acceptable at all once a business is BIR-registered: open.
- Required receipt wording, VAT classification and e-invoice fields when POS becomes a registered system: open.
- Whether the existing supplementary-document notice should print on POS receipts: **assumed yes** (it is what Tavi already shows).
- Share-link token storage matches invoices: confirm in planning.
