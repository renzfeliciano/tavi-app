# RDO/CPA Questionnaire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, one session). Steps use checkbox syntax. Founder's rules override skill defaults: **no commits, no pushes**; tests first and watch them fail; made-up data only.

**Goal:** A settings page where an owner answers a few facts about their business, sees the questions to take to their RDO or CPA, records the answers they get, and downloads a PDF. It feeds nothing.

**Architecture:** Market-profile section `registration.questionnaire` (wording), pure parser in `organizations/domain`, one-row-per-business table and two use cases in `organizations/application`, a settings page with a form, and a PDF route using the shared font registration and `pdfResponse`.

**Tech Stack:** Next 16.4, React 19, Drizzle/Postgres, Zod, `@react-pdf/renderer`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-rdo-cpa-questionnaire-design.md`

## Global Constraints

- Boundaries: modules only through `@/modules/<name>` (browser code `/client`); DB only in `application/`, `infra/`, `schema.ts`, tests; `domain/` pure.
- D12: all wording from `market.registration.questionnaire`; limits are `QUESTIONNAIRE_LIMITS` read by rule, `maxLength` and message; every text field has an `eg()` placeholder.
- Action: `requireOrgContext()`, `assertCan(ctx, "organization.manage")`, audit in the same transaction (codes only, never answers, notes or dates).
- Page has `loading.tsx` matching its layout; settings row only when the market has the section and the role may manage.
- Carbon Copy design; semantic tokens; no animations. Toast on save and failure.

## Review Focus

- Stored code no longer in the market list: ignored on read, dropped on save.
- Answer date without an answer is dropped; date in the future refused.
- Save with nothing changed: no write, no audit row.
- Member (non-manager) opens the page or the PDF: notice / refusal, no data.
- Another business's worksheet never visible (organization from context only).
- PDF when TIN/RDO are not set, and with a very long note (wraps, no crash).

---

### Task 1: Market wording and limits

**Files:** Modify `src/config/markets.ts` (type `MarketProfile.registration.questionnaire`, PH entry; test in `src/config/markets.test.ts` if present, else new `src/config/questionnaire-wording.test.ts`), `src/modules/organizations/domain/limits.ts`.

**Interfaces:** Produces `QUESTIONNAIRE_LIMITS = { note: 1000, answer: 1000 }` and `registration.questionnaire: { facts: { code; label; hint?; options: { code; label }[] }[]; questions: { code; text; context }[] }`. PH facts: `salesBand`, `invoicingNow`, `sellsOnline`, `customersWithhold`. PH questions: `registerSystem`, `eInvoiceDuty`, `onlineSeller`, `quotationNotice`, `correctInvoice`, `withholding` (text for `quotationNotice` is built from `supplementaryDocumentNotice`).

- [ ] Failing test: PH has 4 facts and 6 questions; codes are unique; every fact has at least 2 options; `quotationNotice` text contains `supplementaryDocumentNotice`. Watch FAIL. Implement. PASS.

### Task 2: Domain parser

**Files:** Create `src/modules/organizations/domain/questionnaire.ts` (+`.test.ts`); export from `index.ts` and `client.ts`.

**Interfaces:** `parseQuestionnaire(config, input, { today }) → { ok: true; value: QuestionnaireValue } | { ok: false; errors: Record<string, string> }` where `QuestionnaireValue = { facts: Record<string,string>; questions: Record<string,{ note: string|null; answer: string|null; answeredOn: string|null }> }`; `readQuestionnaire(config, stored) → QuestionnaireValue` (drops unknown codes, fills missing); `questionnaireChanges(before, after) → string[]` (codes that differ); `questionStatus(entry) → "answered"|"not_asked"`. Error keys: `facts.<code>`, `questions.<code>.note|answer|answeredOn`.

- [ ] Failing tests: option not in list → "Choose an option from the list."; note and answer over limit → `tooLong(1000)`; bad date → "Enter a real date."; future date → "That date is in the future."; date with no answer dropped; unknown codes dropped; `readQuestionnaire` ignores stale codes; `questionnaireChanges` empty for equal values; status. Watch FAIL. Implement. PASS.

### Task 3: Table, application, audit

**Files:** Modify `src/modules/organizations/schema.ts` (table `tax_questionnaires`), `src/modules/audit/domain/events.ts` (`questionnaire.updated`); create `application/questionnaire.ts` (+`.int.test.ts`); migration `rdo_cpa_questionnaire` via drizzle-kit.

**Interfaces:** `getQuestionnaire(actor, db?) → QuestionnaireValue & { updatedAt: Date | null }` (empty for a new business; `assertCan(actor,"organization.manage")`); `saveQuestionnaire(actor, input, db?) → { ok: true; changed: string[] } | { ok: false; errors }`. Uses `actor.market.registration.questionnaire` and `todayIn(actor.timezone)`. Upsert on `organization_id`; audit with `{ changed }` only; no write and no audit when `changed` is empty.

- [ ] Failing int tests: empty for new business; save then get; foreign organization sees its own (empty) worksheet; member refused; no-op save writes no audit row; audit metadata has codes and no text; stale stored code ignored on read. Watch FAIL. Implement. PASS.

### Task 4: Privacy

**Files:** Modify `src/modules/organizations/index.ts` (`exportQuestionnaire`), `src/modules/privacy/application/export.ts` (+int test), closure per the existing pattern for tenant tables, `docs/compliance/processing-register.md`, privacy page copy.

- [ ] Failing int tests: export JSON has `questionnaire` with the saved answers; closure leaves/removes it as the other tenant tables do (follow `closure.int.test.ts`). Implement. PASS.

### Task 5: Page, form and skeleton

**Files:** Create `src/app/(app)/settings/questions/{page.tsx,loading.tsx,actions.ts,questionnaire-form.tsx,questionnaire-form.test.tsx}`; modify settings overview (row after Registration, `ClipboardListIcon`), Registration page (link), `src/app/field-placeholders.test.ts` only if it needs a listing.

**Interfaces:** `saveQuestionnaireAction(values) → { ok: true } | { ok: false; errors }` (`requireOrgContext`, `assertCan`, calls `saveQuestionnaire`, `revalidatePath`). Form: radio groups per fact, card per question with note, answer-received, date; Save; "Download PDF" link to `/settings/questions/pdf` outside the form.

- [ ] Failing component tests: errors inline next to the field; Save success toast; failure toast; link to the PDF present and outside the `<form>`; non-managers see the notice (page test). Skeleton registered by the folder-walk test. Implement. PASS.

### Task 6: PDF

**Files:** Create `src/components/document/pdf/questionnaire-pdf.tsx` (+test), `src/app/(app)/settings/questions/pdf/route.tsx`.

**Interfaces:** `QuestionnairePdf({ business: { name; taxId; officeCode }, preparedOn, facts: {label; answer|null}[], questions: {number; text; context; note|null; answer|null; answeredOn|null}[] })`. Route: `requireOrgContext`, `assertCan`, `pdfResponse(<QuestionnairePdf …/>, "RDO and CPA questions")`.

- [ ] Failing test: PDF text contains business name, each question, "Not answered" for a blank fact, the recorded answer when present, and the footer. Watch FAIL. Implement. PASS.

### Task 7: E2E and docs

**Files:** Create `e2e/rdo-questionnaire.spec.ts`, `e2e/rdo-questionnaire-loading.spec.ts`; register both in `ACCOUNT_CREATING_SPECS`; modify `docs/foundation-proposal.md` (D33 row + as-built note), `docs/compliance/ph-e-invoicing.md` (pointer from section 4 to the in-app worksheet).

- [ ] Flow: Settings → RDO and CPA questions, answer two facts, add a note and a received answer, Save, reload keeps them, PDF answers 200 `application/pdf`, axe clean, skeleton matches the page. Run desktop and mobile.

### Task 8: Full verification

- [ ] Lint (0 warnings), typecheck, unit/component, integration, then e2e (never together). Fix. Final review, then delivery to the laptop as before.
