# Purchase Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, one session). Steps use checkbox syntax. Founder's rules override skill defaults: **no commits, no pushes**; tests first and watch them fail; made-up data only.

**Goal:** Suppliers and numbered purchase orders (draft, issue, email, PDF, receive, cancel) that feed nothing else.

**Architecture:** New `purchasing` module (domain/application/infra/schema/client) beside `quotes`; reuses `documents` (numbering, line parsing, calculation), the shared PDF engine and the notifications outbox. UI under `(app)/purchase-orders` and `(app)/suppliers`.

**Tech Stack:** Next 16.4, React 19, Drizzle/Postgres, Zod, `@react-pdf/renderer`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-purchase-orders-design.md`

## Global Constraints

- Boundaries: import modules only through `@/modules/<name>` (browser code: `/client`); DB only in `application/`, `infra/`, `schema.ts`, tests; `domain/` pure.
- Money in minor units; totals only from `calculateDocument`; numbers only from `allocateDocumentNumber` in the issuing transaction.
- D12: titles from `ctx.market`; field examples via `eg()`; limits are named constants read by rule, `maxLength` and message.
- Every action: `requireOrgContext()`, `assertCan`, audit in the same transaction, emails via `enqueueEmail` + `flushOutboxAfterResponse`.
- Every page has `loading.tsx` matching its layout; lists follow the DataTable standing rules; new `(app)` folders in `PROTECTED_PREFIXES`.
- Carbon Copy design; semantic tokens; no animations. Toast on every action; destructive actions ask first.

## Review Focus

- Archived supplier on an existing draft vs a new one.
- Issue/receive/cancel raced from two tabs (second gets a message).
- Expected date before order date; received date in the future or before the order date.
- Another business's supplier id posted in a draft (must be refused).
- Supplier with no email: Email disabled, PDF still works.

---

### Task 1: Foundations (capabilities, audit, numbering kind, market copy)

**Files:** Modify `src/modules/authz/domain/policy.ts` (+test), `src/modules/audit/domain/events.ts`, `src/modules/documents/domain/numbering.ts` (+test), `src/modules/documents/schema.ts`, `src/config/markets.ts`, `src/app/(app)/settings/numbering/*` as needed; migration via drizzle-kit.

**Interfaces:** Produces capabilities `purchasing.read|write|issue` (EVERYDAY); `DOCUMENT_KINDS` gains `"purchase_order"` with default `{ prefix: "PO-", padding: 6 }`; `MarketProfile.documents.purchaseOrder: { singular: string; plural: string }`; audit actions listed in spec P12.

- [ ] Write failing tests: member has the three capabilities; `DEFAULT_NUMBERING.purchase_order` is `PO-`/6; PH market has the purchase order title.
- [ ] Run them: FAIL (missing).
- [ ] Implement; widen the `document_sequences_kind` check; generate migration `purchase_order_numbering`.
- [ ] Run unit tests and `numbering.int.test.ts`: PASS.

### Task 2: Suppliers (schema, input, application)

**Files:** Create `src/modules/purchasing/{index.ts,client.ts,schema.ts}`, `domain/supplier-input.ts` (+test), `domain/limits.ts`, `application/suppliers.ts` (+`.int.test.ts`); modify `src/db/schema.ts`; migration `suppliers`.

**Interfaces:**
- `supplierInputSchema` (zod) fields per spec P2; `SUPPLIER_LIMITS`.
- `createSupplier(actor, input, db?) → {ok:true, supplier} | {ok:false, errors}`; `updateSupplier(actor, id, input)`; `archiveSupplier`, `restoreSupplier`; `getSupplier(actor, id)`; `listSuppliers(actor, {query, page, size, archived}) → PageMeta & {suppliers; total}`; `searchSuppliers(actor, query)` for the combobox.

- [ ] Failing input tests (name required, email format, limits), then failing int tests (create/update/archive/restore, tenant isolation, audit rows, search escapes `%`).
- [ ] Implement schema + input + application. Run: PASS.

### Task 3: Purchase order domain

**Files:** Create `domain/status.ts`, `domain/transitions.ts`, `domain/purchase-order-draft.ts`, `domain/receiving.ts` (each with a test).

**Interfaces:**
- `PO_STATUSES = ["DRAFT","ISSUED","RECEIVED","CANCELLED"]`; `transitionPurchaseOrder(status, "issue"|"receive"|"cancel"|"delete") → {ok:true,to}|{ok:false}`.
- `parsePurchaseOrderDraft(input, {locale, units}) → {ok:true, draft}|{ok:false, errors}`; draft has `supplierId|null, currency, orderDate, expectedDate|null, notes, terms, lines`. Errors: `supplierId` "Choose a supplier from the list.", `expectedDate` before order date.
- `readinessToIssue({supplierId, lineCount}) → Record<string,string>`; `parseReceipt({receivedDate, note}, {orderDate, today}) → result` (not future, not before order date, note ≤ 500).

- [ ] Write tests for every transition pair, each parser error, receive-date bounds. Watch FAIL. Implement. PASS.

### Task 4: Purchase order schema and application

**Files:** Create `schema.ts` additions, `application/purchase-orders.ts`, `application/issuing.ts` (+ int tests); migration `purchase_orders`.

**Interfaces:**
- `savePurchaseOrderDraft(actor, id|null, input, {locale, units}) → {ok:true, order} | {ok:false, errors|notFound|notEditable}` (creates audit `purchase_order.created`).
- `deletePurchaseOrderDraft`, `issuePurchaseOrder(actor, id, {sender:{emailVerified}, market, email:{to,message}|null, now?})`, `emailPurchaseOrder(actor, id, to, message)`, `receivePurchaseOrder(actor, id, input, now?)`, `cancelPurchaseOrder(actor, id, reason)`, `getPurchaseOrder(actor, id)`, `listPurchaseOrders(actor, {query,status,page,size})`, `newPurchaseOrderDefaults(actor)`.
- Each state change locks the row, re-checks status, audits in the same transaction.

- [ ] Failing int tests: save creates then replaces lines; foreign supplier id refused; archived-supplier rule; issue numbers `PO-000001` then `PO-000002` per org and freezes snapshots; double issue second call fails cleanly; receive/cancel rules; delete only drafts; list search/status/paging; audit rows. Watch FAIL.
- [ ] Implement. Run int tests: PASS.

### Task 5: Email

**Files:** Create `src/modules/notifications/domain/purchase-order-emails.ts` (+test); export `purchaseOrderEmail` from the module index; use it in `emailPurchaseOrder` and issue-with-email.

**Interfaces:** `purchaseOrderEmail({businessName, supplierName, number, orderDate, expectedDate|null, total, replyTo, message}) → {subject, html, text}`; subject `"Purchase order PO-000001 from <business>"`; no attachment; user text escaped.

- [ ] Failing tests (subject, escaping, no expected date line when null, daily limit applies). Implement. PASS. Int test: outbox row exists after issue-with-email.

### Task 6: Privacy

**Files:** Modify privacy export (`src/modules/privacy/application/export.ts`, `purchasing` infra `export.ts`), closure, `docs/compliance/processing-register.md`, privacy page copy.

- [ ] Failing int tests: export JSON lists suppliers and purchase orders (without internal ids beyond the existing convention); closure removes them. Implement. PASS.

### Task 7: Supplier screens

**Files:** Create `src/app/(app)/suppliers/{actions.ts,(list)/{page,loading}.tsx,new/{page,loading}.tsx,[id]/{page,loading}.tsx,_components/*,_lib/*}`; `loading-states.test.tsx` registers `(app)/suppliers/(list)`.

- [ ] Failing component tests (form errors inline, archive confirm, list columns/summary) then implement; toasts on every action. Placeholders via `eg()` and market examples.

### Task 8: Purchase order screens

**Files:** Create `src/app/(app)/purchase-orders/{actions.ts,(list)/…,new/…,[id]/edit/…,[id]/(view)/…,_components/{po-form,po-list,issue-dialog,receive-dialog,cancel-dialog,email-dialog,po-actions}.tsx,_lib/{po-view.ts,recipients.ts}}`.

- [ ] Failing tests: `po-view` (title from market, supplier party, expected date row, Cancelled/Received lines, notice), form (Issue blocked with field errors; Save draft toast), dialogs (receive date bounds, cancel reason required), list columns. Implement; form reuses `LineItemsEditor` and the document summary.

### Task 9: PDF

**Files:** Create `purchase-orders/[id]/pdf/route.tsx`; extend `DocumentView`/`DocumentPdf` only if the "Order to" label needs a parameter (`partyLabel`), with a test in `document-pdf.test.tsx`.

- [ ] Failing test: PDF text contains "Order to", number, notice; drafts numbered "Draft". Implement. PASS.

### Task 10: Navigation and plumbing

**Files:** Modify `src/components/app-shell/nav.ts` (+tests/fixtures: sidebar, sidebar-collapsed, hydration), `src/shared/security/headers.ts`, `src/app/loading-states.test.tsx`, `e2e/app-shell.spec.ts`, numbering settings screen.

- [ ] Update tests first (primary nav, New menu, PROTECTED_PREFIXES, numbering kinds), watch FAIL, implement, PASS.

### Task 11: E2E

**Files:** Create `e2e/purchase-orders.spec.ts`, `e2e/purchase-orders-loading.spec.ts`; register in `ACCOUNT_CREATING_SPECS`.

- [ ] Flow: add supplier, make PO, issue (number shown), PDF 200 with `application/pdf`, mark received, cancel another, member allowed, axe clean, skeleton matches. Run on desktop and mobile.

### Task 12: Docs and full verification

**Files:** `docs/foundation-proposal.md` (D32 row, "As built (purchase orders, October 2026)" note).

- [ ] Run lint (0 warnings), typecheck, `npm test`, integration, e2e (never together). Fix. Then final review and delivery.
