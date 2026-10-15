"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { saveQuestionnaire } from "@/modules/organizations";

/** What the form holds: strings only, as typed. Keys are the market's fact and question codes. */
export type QuestionnaireFormValues = {
  facts: Record<string, string>;
  questions: Record<string, { note: string; answer: string; answeredOn: string }>;
};

export type QuestionnaireFormState = {
  values?: QuestionnaireFormValues;
  /** `facts.<code>`, `questions.<code>.note|answer|answeredOn`, or `form`. */
  errors?: Record<string, string>;
  /** Set on every answer from the server: the form starts again from `values` each time. */
  submittedAt?: number;
  /** Set only when the worksheet was saved. */
  savedAt?: number;
};

const NOT_ALLOWED = "Only owners and admins can change the worksheet.";

export async function saveQuestionnaireAction(
  _previous: QuestionnaireFormState,
  formData: FormData,
): Promise<QuestionnaireFormState> {
  const ctx = await requireOrgContext();
  const config = ctx.market.registration?.questionnaire;
  const text = (key: string) => String(formData.get(key) ?? "");

  const values: QuestionnaireFormValues = {
    facts: Object.fromEntries((config?.facts ?? []).map((f) => [f.code, text(`fact.${f.code}`)])),
    questions: Object.fromEntries(
      (config?.questions ?? []).map((q) => [
        q.code,
        { note: text(`q.${q.code}.note`), answer: text(`q.${q.code}.answer`), answeredOn: text(`q.${q.code}.answeredOn`) },
      ]),
    ),
  };
  const submittedAt = Date.now();
  if (!can(ctx, "organization.manage")) return { values, errors: { form: NOT_ALLOWED }, submittedAt };

  const result = await saveQuestionnaire(ctx, values);
  if (!result.ok) return { values, errors: result.errors, submittedAt };
  revalidatePath("/settings/questions");
  // Show what was stored, not what was typed: a date with no answer, or an answer of spaces, is not kept.
  const saved: QuestionnaireFormValues = {
    facts: result.value.facts,
    questions: Object.fromEntries(
      Object.entries(result.value.questions).map(([code, entry]) => [
        code,
        { note: entry.note ?? "", answer: entry.answer ?? "", answeredOn: entry.answeredOn ?? "" },
      ]),
    ),
  };
  return { values: saved, savedAt: submittedAt, submittedAt };
}
