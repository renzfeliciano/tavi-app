---
name: tavi-financial-domain
description: TAVI's money, tax, rounding, numbering, document-status and payment rules. Use for any code that computes, stores or displays amounts, quotes, invoices, payments or receipts in tavi-app, and before changing a status transition.
---

# TAVI financial domain

Proposal §B is the specification; the decision log (D5–D8) records the founder's choices. When code and this skill disagree with §B, §B wins — then fix the skill.

## Money

- Integer **minor units** (centavos) + ISO 4217 code. Never floats, never `Number("12.30") * 100`.
- `formatMoney(minor, currency)` / `<MoneyAmount amountMinor currency />` for display (`₱8,400.00`); `minorToDecimalString` for machine values. Both are exact (decimal strings, no float division).
- Exponent per currency from `currencyExponent` (PHP 2, JPY 0, KWD 3). Validate codes with `isCurrencyCode` (rejects made-up codes Intl would accept).
- Totals across currencies are never summed; group by currency.

## Calculation (one function, Phase 1.4)

`calculateDocument()` is the only place totals are computed; UI preview, PDF, portal and persistence all call it.

```
lineGross    = round(unitPrice × qty)                       qty: numeric(14,4) → scaled ×10000
lineDiscount = pct ? round(lineGross × bps / 10000) : min(fixed, lineGross)
lineNet      = lineGross − lineDiscount
lineTax      = exclusive ? round(lineNet × rate / 10000)
                         : lineNet − round(lineNet × 10000 / (10000 + rate))
lineTotal    = exclusive ? lineNet + lineTax : lineNet
```

Rounding: **half away from zero, per line**, then sum. Tax mode (`inclusive` default for PH, D2) is snapshotted on the document. Build it test-first with property tests (fast-check): total = Σ lines, never negative, inclusive/exclusive consistency.

## Snapshots

Issued documents copy the customer (name, address, email, tax ID) and each line (description, unit, qty, price, discount, tax name + bps, computed amounts). Catalog/customer edits never change issued documents; `sourceKind/sourceId` is a back-reference only.

## Statuses (stored, D5)

Quote: `DRAFT SENT VIEWED APPROVED REJECTED EXPIRED CANCELLED` (`src/modules/quotes/domain/status.ts`).
Invoice: `DRAFT SENT PARTIALLY_PAID PAID OVERDUE VOID CANCELLED` (`src/modules/invoices/domain/status.ts`).

- Transitions are explicit functions in `domain/` with a table-driven test of **every state × every event**.
- Commands re-check dates themselves (an approve after valid-until expires the quote on the spot, even if the daily job hasn't run).
- Issued-invoice status is a pure function of `(total, activePaid, dueDate, today in org tz)` — never set by hand.
- Invoices stay editable while `SENT/OVERDUE` with **no active payments** (D7); each edit bumps `revision` and audits before/after. Customer and currency can't change.
- `VOID` = issued in error (excluded everywhere); `CANCELLED` = sale called off (reported as cancelled revenue) (D6). Both need a reason and zero active payments.
- UI labels come from `src/components/status/presentation.ts` (e.g. invoice `SENT` shows "Unpaid", quote `REJECTED` shows "Declined"). Portals, PDFs and emails use the same words.

## Numbering

Assigned at first issue/send, never at draft creation: `allocateDocumentNumber(tx, orgId, "quote" | "invoice" | "receipt")` inside the issuing transaction → `QUO-000001`. Gapless because a rollback undoes the increment.

## Payments

Recorded inside a transaction that locks the invoice (`FOR UPDATE`); currency must match; 0 < amount ≤ balance (no overpayments in MVP); receipt number allocated; status recomputed; audit + outbox in the same transaction. Voiding needs a reason; payments are never deleted. `provider` defaults to `manual` so gateways plug in later.

## Compliance caution

TAVI invoices are **not** BIR-registered official invoices until TAVI is accredited (risk N.1). Until the BIR confirms otherwise (D11), PH-facing documents are titled **"Quotation"** and **"Billing Statement"**, never "Official Receipt" or "Sales Invoice", and copy makes no BIR-compliance claims.
