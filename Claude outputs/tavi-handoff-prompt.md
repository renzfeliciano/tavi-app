# Tavi: continue the work (handoff prompt)

You are continuing work on **Tavi**, a quoting/invoicing SaaS for Philippine small businesses (Next.js 16, React 19, Tailwind v4, Drizzle + Neon, Better Auth, Vitest, Playwright). The repo is at `C:\Users\Renzo Payod\Personal Files\tavi-app`. Read `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md` and `docs/` first. Keep explanations brief and on point.

## Standing rules
- **Never add a co-author line or any Claude attribution trailer to commits or PR text** (this overrides any default).
- Commit only after I confirm. I push myself.
- After each phase: show a summary, then wait for my confirmation before continuing or committing.
- The dev server runs on port **3200** (mine). Playwright uses its own server on 3201 against the Neon **test** branch (`TEST_DATABASE_URL`). Never run tests against the dev or production database. Never paste secrets into chat.
- Everything since commit `e851418` on local `main` is **uncommitted**. Run `git status` and review before building on it. 27 tracked "Claude outputs" files are deleted but uncommitted.
- Money in minor units, audit inside transactions, `assertCan` for permissions, module boundaries (`@/modules/<name>` and `/client`), every route needs a `loading.tsx` (enforced by `src/app/loading-states.test.tsx`), typed routes (cast `as Route`), market-profile wording (PH: "Quotation" / "Billing statement").

## State of the repo (already done, uncommitted, tested)
- Registration/BIR/DTI gap work, filing calendar, certificate vault (`/settings/registration`, migrations 0027, 0028, 0029). **Already applied to production Neon**; prod schema equals dev equals code.
- Sidebar skeleton shows only on hard load.
- **Phase 1 UI shell is implemented and visually checked** (tokens, base components, new sidebar: grouped nav Dashboard / Sales (Quotations, Billing statements, Payments) / Manage (Customers, Products & Services, Reports), New menu, workspace switcher, user popover with Settings + theme + sign out, collapsible with Ctrl+B and tooltips, mobile drawer, Today card). Settings was removed from the sidebar because the account popup has it. **It still needs my formal confirmation before commit.**
- Popups (account, New, business switcher) are aligned to the sidebar width.
- Cursor standard: `cursor-pointer` on every interactive element, `not-allowed` / `progress` when disabled (base CSS rules plus Button, DropdownMenu, Select, Combobox, Input, Tabs).
- `BackLink` redesigned as a visible bordered button ("Back to X"); added to Security and Recycle bin. All detail and sub-pages already have it.
- Number badge centering fixed in code (`inline-flex items-center justify-center leading-none`), but **not yet visually confirmed**.
- Record-payment modal: **multi-recipient acknowledgements are done.** `recordPayment` takes `recipients: string[]` (validated, de-duplicated, max 5, one email each, hourly limit counts the whole list). The UI has the customer checkbox plus an "Also send to another email" field with removable chips. Tests were added in unit, integration and e2e (`e2e/invoices.spec.ts`; the e2e additions have **not been run**).
- Last verification: tsc and eslint clean; unit and component tests pass; payments and notifications integration tests pass. Integration tests in `outbox.int.test.ts` fail only because of sandbox clock skew (environmental).

## Pending: do these FIRST (verification and cleanup)
1. **Run Playwright smoke and regression** (desktop and mobile projects) against the test branch: `npx playwright test` (globalSetup resets and migrates the test DB). It must run somewhere that can reach Postgres on port 5432 (my Windows machine works). Fix failures. Specs known to need updating for the new UI:
   - `e2e/settings.spec.ts` (around line 35): Settings is no longer in the sidebar, so go through the account menu.
   - Any spec that uses old nav labels (e.g. "Quotes") or old back-link names (now "Back to X").
   - The new payment-recipient steps in `e2e/invoices.spec.ts`.
2. Also run the full unit/component suites, integration suites (in batches, they are slow), `tsc --noEmit` and `eslint`, then report results. Production DB already matches the code, so no more migrations are needed unless new ones are added; if you add migrations, apply them to prod Neon after review and keep `drizzle.__drizzle_migrations` in sync.
3. Visually re-verify in the browser (I will sign in): sidebar badge centering, Back button on Security and Recycle bin, popup widths, collapsed and drawer states, light and dark.
4. Task #19: show me sample modal UIs (concerned/danger, curious form, happy send, waiting/idle, neutral, phone bottom-sheet, in light and dark), then verify them.
5. Payments design steps still open: #13 withholding-tax credits (in progress; see "Reference documents I supplied" for the BIR 2307 fields), #14 installment schedule, #15 credit notes/refunds, #16 verify all.
6. Update `DESIGN.md` with notes on the sidebar, registration area, cursor standard and BackLink.
7. Present the **Phase 1 summary plus Step 0 audit** (branding found and kept), get my confirmation, then commit (no attribution trailers).

## The redesign brief (original, keep following it)

Redesign Tavi's UI for a more distinctive, less generic look WITHOUT losing the existing branding. Also add new document types, update the legal pages, and prepare a compliance questionnaire. Work in phases, and stop after each phase for my review before continuing. **The UI redesign applies to every page.**

### Step 0: Audit first
Read the theme/tokens, layout, sidebar, shared components, and the document model (quotation, billing statement, payment, numbering). List the branding you found and keep it as the base. At minimum, KEEP:
- The Stamp mascot, all its states and idle motion
- The indigo/purple primary color
- The monospace treatment for document numbers and status ("Draft", "INV-000001")
- The live document preview in the editors
- The plain-spoken, friendly copy tone
- The mascot's footer role in modals
Don't add dependencies unless truly needed.

### Design direction
The app looked like a generic template (gray background, white cards, purple button, same layout everywhere). Build a recognizable identity from the Stamp/paperwork idea (stamps, receipts, ink, paper), not from trendy SaaS patterns. No generic gradients or glassmorphism. Define and apply tokens for color, type scale, radius, shadow, and spacing. Design mobile-first, since customers mostly use phones. (Existing design rules: "Real Ink Rule", "Two Signals Rule", tabular money.)

### Phase 1: Foundation + shell — implemented, awaiting my confirmation (see above)
Remaining items from the original Phase 1 brief that are not yet done: add **Purchase orders** and **Receipts** to the Sales nav group and the New menu once Phase 5 exists, and add a **Books** group (the five journals) with its New-menu items once Phase 5B exists; the mascot bubble must not overlap page content; unify terminology ("billing statement" everywhere, no "invoice" in the discard modal, no "bills" in Reports).

### Phase 2: Dashboard + list pages
- Dashboard: richer KPI cards (trend or sparkline from real data), recent activity with icons and links to each document, a "Needs your attention" list, a good empty state
- Customers: initials avatars, outstanding balance, last activity, hover state, full-width rows
- Products & Services: icon or category, price emphasis, edit affordance, hover state
- Billing statements and Quotations lists: better status badges (include Overdue), quick actions per row, consistent row design
- Payments list too. On mobile, rows become cards. No horizontal scrolling.

### Phase 3: Editors + modals
- Quotation and billing statement editors: sticky action bar for Discard and Send, Form/Preview toggle on mobile, live preview that looks like real paper
- Fix the contradiction: the editor says "Changes save as you go" but the discard modal says "Nothing has been saved yet". Make the copy match actual behavior (check the code).
- Record payment modal: amount, date, method first; Tax withheld (BIR 2307), Reference no., Bank, Sender, Time paid, Notes behind "More details". Bottom sheet on mobile. Keep the new multi-recipient acknowledgement section.
- Keep the Send modal's options and the mascot footer.

### Phase 4: Reports + Settings
- Reports: remove redundancy between presets and custom range (Show button only for custom range, or apply automatically), add a simple sales/payments chart, keep Download CSV
- Settings: left sub-nav on desktop (list on mobile), better width use on Business profile, readable disabled states, including the Registration, Security and Recycle bin pages.

### Phase 5: Purchase orders, Collection receipts, Acknowledgement receipts
Reuse the existing editor, live preview, numbering, send flow, and list patterns. No one-off screens.

Purchase order (PO), the digital version of a PO pad:
- Issued by the business to a supplier: supplier details, line items, quantity, unit cost, delivery date, terms, notes
- Own number series (PO-000001), statuses (Draft, Sent, Received, Cancelled), PDF/print, email
- Does not affect sales totals or receivables

Collection receipt (CR) and Acknowledgement receipt (AR):
- Proof that money was received: payer, amount, date, method, reference, purpose, received by
- Required "Received for" type, because these are NOT sales invoices: Reimbursement, Deposit/bond, Advance for a third party, Pass-through (collected on behalf of someone else), Loan/capital, Other (free text)
- If the receipt relates to an existing billing statement, link it and apply it as a payment. Never create a second sale.
- Non-sale receipts are tracked separately, excluded from sales/income totals, and shown in their own Reports section. They are always recorded and exported in CSV, never hidden.
- Own number series (CR-000001 / AR-000001), statuses, PDF/print, email

Guardrails:
- A CR or AR must never replace a billing statement for an actual sale of goods or services. If the chosen type looks like a sale (e.g. service fees), show a clear warning that a billing statement is required.
- Print "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX." on every PO, CR and AR. Keep this wording and the helper texts in one config file so they're easy to change after the CPA/RDO answers.
- No feature, label, or copy may suggest leaving income out of tax reporting. Avoid words like "unreported" or "off the books".
- Add short helper text in each editor on when to use that document.

### Phase 5B: Books (the five journals)
The five classic books of original entry, for small businesses that want their records in one place. Reuse the existing list patterns, numbering, attachments, CSV export and permissions. Tavi is a record-keeping aid here; keep wording in the same config file as Phase 5. The business registers its own books with the BIR, so Tavi never claims its journals are registered; it only stores and prints the business's registration details (see "Book registration details" below).

**Brainstorm and write a short spec first and get my approval before any code.** This phase adds new data (purchases, money paid out, journal entries), so it is architectural, not a quick change.

Principles for all five:
- **Auto-post from source documents wherever one exists.** The business should not type the same thing twice. Manual entry only where no source exists. Posting happens in the same transaction as the source action, is idempotent, and is audited.
- **No silent edits or deletes.** Voids, credit notes and corrections create a reversing entry that stays visible. Money in minor units. Permissions through `assertCan` (owner/admin post and edit manual entries; others read-only unless granted).
- **Every entry links to its source, and every source document shows the entry it created.**
- **Layout:** each journal is a list page with date-range filter, totals row, status where relevant, and Download CSV (plus a print view). Mobile: rows become cards, filters in a bottom sheet, no horizontal scrolling. Every route needs its `loading.tsx`.
- **Navigation:** new **Books** sidebar group (Sales journal, Purchase journal, Cash receipts, Cash disbursements, General journal). New menu gets "Record purchase", "Record money paid out" and "Journal entry".
- **Names come from the market profile**, not hard-coded. The PH profile uses the names printed on BIR book cover pages: Subsidiary Sales Journal, Subsidiary Purchases Journal, Cash Receipts Journal, Cash Disbursement Journal, General Journal, each with a plain-language subtitle ("Sell now, collect later", "Buy now, pay later", "Money comes in", "Money goes out", "Everything else").
- Backfill existing billing statements and payments into the journals with a reviewed migration or script. Apply to production Neon only after review.
- Add a short helper text on each journal page saying what belongs there.

1. **Purchase journal** (buy now, pay later): goods or services bought on credit, for example an order paid later with Shopee PayLater or bought from a supplier on terms.
   - Fields: date, supplier or creditor (or the pay-later provider), description, category (supplies, inventory, equipment, other), amount, input tax shown separately only when a supporting invoice is attached, due date, reference or PO number (link to a Phase 5 PO when one exists), attached receipt or photo.
   - Status: Unpaid, Partly paid, Paid. Shows what the business still owes and what is due soon.
   - Posting: increases what is owed (payable) and records the purchase or expense. Paying it later happens in the Cash disbursement journal and reduces the payable.
   - Does not affect sales totals. A PO marked Received can offer "Record purchase".

2. **Cash disbursement journal** (money goes out): cash actually paid out, for example "Paid rent, P500.00".
   - Fields: date, payee, purpose or category, method (cash, bank, e-wallet, card), reference or receipt number, amount, attached proof.
   - Two kinds: a direct expense paid right away, or a payment of an earlier credit purchase (pick the purchase; it reduces that payable and cannot overpay it).
   - Posting: records the expense or reduces the payable, and reduces cash, bank or e-wallet.

3. **Cash receipt journal** (money comes in): cash received, for example "Received P5,000.00 from a customer for a service billing statement".
   - Auto-posted from Payments (including down payments and installments) and from Collection and Acknowledgement receipts (Phase 5).
   - Fields: date, received from, source document (billing statement, CR or AR), method, reference, amount, applied to which receivable, tax withheld (BIR 2307) when the payment has it, so gross, cash received and withheld are all visible.
   - Keep two clearly separate sections: **collections on billing statements** (sales) and **other receipts** (non-sale, by "Received for" type). Non-sale receipts never count as sales or income totals, are always listed, and are always in the CSV.
   - Posting: increases cash, bank or e-wallet and reduces the customer's receivable (or records the non-sale item).

4. **Sales journal** (sell now, collect later): sales made on credit, where the customer pays later. Example: a service with a 50% down payment first and the other half after the service is done.
   - Auto-posted when a billing statement is issued (not Draft), not when it is paid. Cancelled or voided statements, credit notes and refunds appear as reversing entries.
   - Fields: date, billing statement number, customer, description, gross sales, tax per the business's tax type (non-VAT, 8% option, VAT), net, terms and due date, status (Unpaid, Partly paid, Paid), balance.
   - 50% down payment example: the full sale is recorded when the billing statement is issued. The first 50% received goes to the Cash receipt journal, linked to the statement, and reduces its balance. The remaining 50% stays as the customer's receivable until paid after the service, then appears in the Cash receipt journal too. This follows the installment schedule from payments step #14.
   - Whether a down payment is billed first or receipted first depends on the CPA answer (see Phase 7). Keep that behavior in the single config file so it is easy to change.

5. **General journal** (everything else): transactions that fit none of the four books.
   - Examples: opening balances, owner's capital and withdrawals, loans received, depreciation, adjustments and corrections, reclassifications, bad-debt write-offs, system reversing entries that have no better home.
   - Manual entry: date, description, reference, attachment, and debit/credit lines (account, debit, credit). Total debits must equal total credits or it cannot be saved.
   - Corrections reverse and repost; the original stays visible.

Book registration details (from the BIR cover pages I supplied as references):
- Each of the five books can store its registration details as they appear on the BIR cover page: book registered (name), type of book (Manual, Loose-leaf or Computerized; my samples are all "Manual"), quantity, volume no. (e.g. "1 of 1"), date registered, date approved, PTU No. / AC Control No. (my samples say N/A), RDO, ARN, and an attached scan or PDF of the cover page. Extend the existing certificate vault (`/settings/registration`); check which document types it already has before adding any.
- The cover page note says it must be displayed in front of each registered book. So the print and PDF view of every journal opens with a cover section showing the stored details (and the attached scan if there is one). If nothing is stored, show a plain "Books not registered yet" note that links to the registration checklist. Never invent or auto-fill registration numbers.
- Add to the registration checklist: "Register your books of account" and "Display the BIR receipt/invoice notice where customers can see it". The notice is a government-issued sign; do not recreate or imitate it (it carries the BIR seal), only remind.
- Whether journals kept in an app count as a computerized book that needs a Permit to Use or accreditation is an open RDO question (Phase 7). Do not decide it in code; keep the type of book as plain stored data.

Recommended data approach (confirm in the spec): store every entry as balanced debit and credit lines against a small editable default chart of accounts for a Philippine service business, so the five journals are views of one ledger and totals always agree. Likely new tables: accounts, journal entries and lines, purchases, disbursements. Likely a new `books` module with its own `/client` entry; respect module boundaries.

Guardrails:
- Nothing in labels or copy may suggest hiding income or expenses from tax reporting.
- A journal entry never creates or replaces a billing statement, CR or AR.
- Sales journal totals must equal the sales shown in Reports for the same dates; Cash receipt journal sales collections must equal Payments for the same dates. Add tests that prove it.

Tests: posting from each source (issue billing statement, record payment, CR/AR, purchase, disbursement), debits equal credits, the 50/50 down payment example, reversal on void, non-sale receipts excluded from sales totals, overpayment blocked on payables, permissions, numbering where used, and e2e happy paths for each journal on desktop and phone.

### Phase 6: Privacy Policy and Terms of Service
Update both pages to match the app as it is now, including Phases 5 and 5B. Match the branding, make them readable on mobile, link them from the footer, sign-up, and Settings, and show a "Last updated" date.
- Privacy Policy (Philippine Data Privacy Act, RA 10173): what Tavi collects (account info, business profile and TIN, customer names/emails/phones/addresses, quotations, billing statements, purchase orders, receipts, payments, purchases and money paid out, supplier details, journal entries, uploaded QR codes, registration documents), why, who processes it (hosting, email provider, database), retention and deletion, security, user rights (access, correction, deletion, complaint to the National Privacy Commission), and a contact placeholder. The user's customers' data is the user's responsibility, and Tavi only processes it on their behalf.
- Terms of Service: Tavi is a tool, not tax, legal, or accounting advice. Users are responsible for BIR registration, invoicing compliance, and the accuracy of what they issue. Free "as is" for now, acceptable use (no fraudulent or evasive documents), account termination, data export, limitation of liability, governing-law placeholder.
- Don't invent facts. Use marked [PLACEHOLDER]s for company name, address, email, and domain (we don't own one yet), and list them for me at the end.
- Put a note at the top of the drafts that a lawyer should review them before launch.

### Phase 7: Compliance questionnaire (RDO and CPA)
Create `docs/compliance-questionnaire.md` with two clean, send-ready sections, plus a short one-paragraph context intro about Tavi (an invoicing/quoting app for small service businesses in the Philippines) at the top of each. Leave space under each question for the answer.

For the CPA:
1. Does an app-generated billing statement/invoice need any BIR registration (CAS, permit to use), and who registers: Tavi or each business using it?
2. What fields and wording must an invoice show for non-VAT, 8% option, and VAT-registered sellers?
3. When can a business issue a Collection or Acknowledgement Receipt instead of an invoice? Do reimbursements, deposits, and pass-through collections qualify?
4. How should down payments for services be documented: invoice first, or receipt first?
5. What wording is required on supplementary documents, and is "This document is not valid for claim of input tax" enough?
6. How should non-sale receipts appear in the books and returns?
7. Do purchase orders need registration or any particular serial numbering?
8. How should tax withheld (2307) be recorded when a payment is received?
9. Are digital-only documents acceptable, and what are the record-keeping rules?
10. Do journals kept in an app (sales, purchase, cash receipts, cash disbursements, general) need BIR registration as books of accounts, or any particular format, for a small business?
11. Should a sale on credit be recorded when the billing statement is issued or when it is collected, for each tax type (non-VAT, 8% option, VAT)? How are down payments and installments recorded?
12. For a purchase paid later through a pay-later provider (for example Shopee PayLater), who is the creditor in the books, and what supporting document is needed to claim the expense?

For the RDO:
1. Does a digital document generated from an app (invoice, CR, AR, PO) need an Authority to Print or permit before use? What is the process?
2. Do CR, AR, and PO pads or digital versions need to be registered, and what are the serial number rules?
3. What is the required footer or stamp text for supplementary documents?
4. Can a business issue purely digital documents and never print them?
5. What, if anything, must a software provider like Tavi register or get accredited for?
6. If a business keeps its journals in an app, is that a computerized book that needs a Permit to Use or accreditation (the registered covers I have show "Manual" books with PTU/AC "N/A"), or can the business keep registered manual or loose-leaf books and use the app as a working record? How does the rule that the cover page is displayed in front of each registered book apply to printouts from an app?

## Reference documents I supplied (design input only)
I gave you scans of real documents. They contain a real person's TIN, name, address and a real payor. **Do not copy any of that data into the repo, tests, fixtures, docs or screenshots; use made-up data.** What to take from them:
- **BIR Form 2307 (Certificate of Creditable Tax Withheld at Source)**: use for payments step #13. Fields: period covered (from/to), payee (the business: TIN, name, address), payor (the customer: TIN, name, address), income payments subject to withholding with the ATC code, amounts split across the 1st, 2nd and 3rd month of the quarter, total, and tax withheld for the quarter. In my sample the tax withheld is 2% of the income payment, so store the ATC and rate as data; do not hard-code a rate. Model it so the certificate often arrives after the payment: status "2307 pending" then "received", attach the scan, link it to one or more payments and billing statements, show gross, cash received and withheld in the Cash Receipts Journal, and add a creditable-withholding report by quarter and payor with CSV.
- **BIR book cover pages** (five books, all "Manual", registered): see "Book registration details" in Phase 5B.
- **"This establishment MUST issue Receipt/Invoice" notice**: a government sign to display in public view. Reminder item in the registration checklist only.

## Requirements for all work
- WCAG AA contrast in light and dark mode
- Full keyboard navigation, `aria-current`, `aria-expanded`, visible focus states
- Respect `prefers-reduced-motion`
- Check each phase in light, dark, desktop, tablet, and mobile
- Add or update tests for document numbering, receipt types, the sales-total exclusion, and journal posting and balancing (Phase 5B)
- Cursor standard: every interactive element gets `cursor-pointer`; disabled gets the appropriate cursor
- Every sub-page that needs it has a visible Back button
- After each phase, show a summary and wait for my confirmation before committing
- **Never add a co-author line or any Claude attribution trailer to commits**

## Suggested order
Pending items 1 to 7 above, then Phase 2, 3, 4 (every page), then payments steps #13 to #16, then Phase 5, 5B (books and journals; spec first), 6, 7, stopping for my review after each phase.
