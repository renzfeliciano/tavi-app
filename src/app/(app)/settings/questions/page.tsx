import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getQuestionnaire } from "@/modules/organizations";
import { SettingsPageHeader } from "../_components/settings-page-header";
import type { QuestionnaireFormValues } from "./actions";
import { type QuestionnaireCopy, QuestionnaireForm } from "./questionnaire-form";

export const metadata: Metadata = { title: "Questions for your tax office" };

export default async function QuestionsPage() {
  const ctx = await requireOrgContext();
  const config = ctx.market.registration;
  if (!config) notFound();
  const { authority, questionnaire } = config;
  const { title, intro: description } = questionnaire;
  // The worksheet sits beside the tax details: owners and admins only.
  if (!can(ctx, "organization.manage")) {
    return (
      <>
        <SettingsPageHeader title={title} description={description} />
        <p className="mt-6 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-ink-subtle">
          Only owners and admins can see the worksheet.
        </p>
      </>
    );
  }

  const worksheet = await getQuestionnaire(ctx);
  const initial: QuestionnaireFormValues = {
    facts: worksheet.facts,
    questions: Object.fromEntries(
      Object.entries(worksheet.questions).map(([code, entry]) => [
        code,
        { note: entry.note ?? "", answer: entry.answer ?? "", answeredOn: entry.answeredOn ?? "" },
      ]),
    ),
  };
  const copy: QuestionnaireCopy = {
    title,
    facts: config.questionnaire.facts.map((f) => ({
      code: f.code,
      label: f.label,
      hint: f.hint,
      options: f.options.map((o) => ({ ...o })),
    })),
    questions: config.questionnaire.questions.map((q) => ({ ...q })),
  };

  return (
    <>
      <SettingsPageHeader title={title} description={description} />
      <div className="mt-8 grid max-w-3xl gap-8">
        <QuestionnaireForm initial={initial} copy={copy} editable pdfHref="/settings/questions/pdf" />
        <p className="text-sm text-pretty text-muted-foreground">
          Your {authority} details, like your {config.office.label}, are on the{" "}
          <Link href="/settings/registration" className="font-medium text-foreground underline underline-offset-4">
            Registration
          </Link>{" "}
          page and print at the top of the PDF. These questions are not legal or tax advice, and nothing here changes your settings or your documents.
        </p>
      </div>
    </>
  );
}
