# RDO/CPA questionnaire — design (October 2026)

Status: written under the founder's standing "go ahead with the next phase" instruction; the two design questions were answered with the recommended options. Classified **architectural** (new table, new market-profile section, new screen and PDF).

## Understanding

Tavi's compliance notes (`docs/compliance/ph-e-invoicing.md`, section 4) list questions that only the RDO or a CPA can answer. Some are the founder's (is Tavi itself an ESP? where is the JSON spec?). Others are every business owner's: must I register my invoicing system, am I required to e-invoice, how do I correct an issued invoice, how do I record tax a customer withholds. Success: an owner opens one page, says a few things about their business, sees the questions to take to their RDO or CPA, downloads a PDF to bring along, and later types in what they were told.

Said by the founder: the **business owner** fills it in, to prepare for their CPA; answers are **saved to the business** and **exported as PDF**. Not chosen: pre-filling settings, or a printable form with no storage. Interpretation I am stating rather than asking again: the owner answers a handful of facts about their business and the page lists the questions to ask; the founder's vendor-side questions (ESP status, JSON spec) stay in the compliance note and are not in the product. The answers **feed nothing**: no setting, document or calculation reads them.

## Decisions

| # | Decision | Why |
|---|---|---|
| Q1 | The worksheet lives in the `organizations` module beside registration. One row per business, table `tax_questionnaires` (`organization_id` primary key, `facts jsonb`, `questions jsonb`, `updated_by`, timestamps). | It is about how the business is registered, and one row means one current worksheet, with no versions to manage. |
| Q2 | Two parts. **About your business**: a few multiple-choice facts. **Questions for your RDO or CPA**: a fixed list. Both, and the page's title, intro, Settings line, Registration prompt and PDF headings, come from `market.registration.questionnaire`, so another country adds its own (D12). | No wording is hard-coded; a market without the section has no page. |
| Q3 | Facts (PH): yearly sales band (under ₱3M, ₱3M–₱20M, over ₱20M, not sure); how invoices are issued today (BIR-printed booklet, registered computerized system, none yet); whether quotes or invoices are sent online (yes, no, not sure); whether customers withhold tax (yes, some do, no, not sure). Each answer is optional. | These are the facts the compliance note says change the answers (taxpayer class, e-invoicing duty, withholding). |
| Q4 | Questions (PH, six): register the invoicing system and how; e-invoicing duty and the Permit to Issue; whether sending quotes and invoices online counts as e-commerce; whether quotations must carry the market's supplementary-document notice (read from `supplementaryDocumentNotice`); how to correct an issued registered invoice; how to record tax a customer withholds and which ATC codes apply. Each has the question and one line on what Tavi does today. | Section 4 items 1, 2, 3, 5, 6 and 8, reworded for an owner. |
| Q5 | Per question the owner can keep **a note** (up to 1,000 characters) and, once told, **the answer received** (up to 1,000 characters) with **the date told**. A question is "Answered" when an answer is saved, otherwise "Not asked yet". | Lets the page be the record of what the CPA said, which is what the owner needs to come back for. |
| Q6 | One explicit Save for the whole page (no autosave), toast on success and failure. Saving with nothing changed writes nothing and no audit row. Stored codes the market no longer lists are ignored on read and dropped on save. | House form rules. |
| Q7 | Access: `organization.manage` (owners and admins), as Registration, because the page shows the TIN and RDO code. No new capability. | Same sensitivity as registration. |
| Q8 | Audit action `questionnaire.updated`, written in the save transaction, with the codes that changed and nothing else (never an answer, note or date). | House rule, and the free text may name people. |
| Q9 | PDF at `/settings/questions/pdf`, A4: business name, TIN and RDO code from registration (blank if not set), date prepared, part 1 answers ("Not answered" when blank), part 2 numbered questions each with the owner's note, the answer received if any, or ruled lines to write it. Footer: "Prepared with Tavi. Not legal or tax advice." Not a transaction document, so no supplementary notice. | Something to bring to the RDO or CPA. |
| Q10 | Privacy (D15/D16): the table is added to the privacy export and to the processing register, and closing a business deletes its worksheet (its notes may name people and no tax rule asks for it, unlike the records that stay). The Privacy Notice's list of stored data gains "your answers to the RDO and CPA worksheet". No `LEGAL.version` bump (no new purpose or provider). | Same ruling as receipts and purchase orders. |
| Q11 | Navigation: a row "RDO and CPA questions" in Settings after Registration (only when the market has the section, owners and admins), and a link from the Registration page. No sidebar row. | Settings are visited rarely; it is secondary to registration. |

## Data

`tax_questionnaires`: `organization_id` (primary key, references `organizations`, cascade), `facts` (`jsonb`, object: fact code → option code), `questions` (`jsonb`, object: question code → `{ note, answer, answeredOn }`, each possibly null), `updated_by` (references `users`, set null), `created_at`, `updated_at`. Checks: both columns are JSON objects. No tenant data is trusted from the client: the organization comes from `requireOrgContext()`.

`MarketProfile.registration.questionnaire`: `{ facts: { code; label; hint?; options: { code; label }[] }[]; questions: { code; text; context }[] }`. Limits are named constants (`QUESTIONNAIRE_LIMITS`: note 1,000, answer 1,000) read by the rule, the `maxLength` and the message.

## Screen

`/settings/questions` (title "RDO and CPA questions", wording from the market): intro line; part 1 as radio groups; part 2 as a list of cards, each with the question, the one-line context, a note field, an answer-received field and a date; Save and Download PDF in a bar at the foot; the download is a link, not part of the form. Skeleton in the real layout (`loading.tsx`). Owners and admins only; others see the same notice as Registration.

## Errors and edge cases

- An option code not in the market list: "Choose an option from the list." An answer or note over the limit: `tooLong(max)`. A date that is not real, or in the future: "Enter a real date." / "That date is in the future." An answer date with no answer is dropped.
- Two tabs saving: the second overwrites the first as a whole (one row, last write wins); acceptable for one worksheet.
- No registration saved yet: the PDF header leaves TIN and RDO blank rather than failing.
- Unknown market or none: `notFound()`.

## Testing

Domain (pure): parser per error above, unknown codes dropped, "Answered" status, change detection. Integration: get returns empty for a new business; save then get; foreign organization cannot read or write; non-managers refused; no-op save writes no audit; audit row holds codes only; privacy export lists it; closure removes it. Component: form errors inline, Save toast, download link, skeleton. PDF: text contains the business name, each question and "Not answered". E2E: open Settings → RDO and CPA questions, answer, save, reload shows it, PDF answers 200 `application/pdf`; a member sees the notice; axe clean; skeleton matches.

## Out of scope

Pre-filling or changing any setting from the answers, emailing the worksheet to a CPA, a CPA login, several worksheets or history, other markets' wording, the founder's vendor-side questions (ESP, JSON spec), attachments.
