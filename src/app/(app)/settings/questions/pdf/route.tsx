import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { QuestionnairePdf } from "@/components/document/pdf/questionnaire-pdf";
import { taxIdStatement } from "@/config/markets";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile, getBusinessRegistration, getQuestionnaire } from "@/modules/organizations";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";

// The worksheet to bring to the tax office or an accountant. Owners and admins only: it prints the TIN and RDO code. It
// prints what is saved, not what is being typed.
export async function GET() {
  const ctx = await requireOrgContext();
  const config = ctx.market.registration;
  if (!config) return new Response("Not found", { status: 404 });
  if (!can(ctx, "organization.manage")) return new Response("Only owners and admins can download the worksheet.", { status: 403 });

  const [profile, registration, worksheet] = await Promise.all([
    getBusinessProfile(ctx),
    getBusinessRegistration(ctx),
    getQuestionnaire(ctx),
  ]);
  const wording = config.questionnaire;
  const optionLabel = (factCode: string, optionCode: string | undefined) =>
    wording.facts.find((f) => f.code === factCode)?.options.find((o) => o.code === optionCode)?.label ?? null;
  const showDate = (date: string | null) => (date ? formatCalendarDate(date, ctx.locale) : null);

  return pdfResponse(
    <QuestionnairePdf
      title={wording.pdfTitle}
      answerLabel={wording.answerLabel}
      business={{
        name: profile.legalName?.trim() || profile.name,
        taxId: registration.taxId ? { label: taxIdStatement(ctx.market, registration.taxRegistration), value: registration.taxId } : null,
        office: registration.taxOfficeCode ? { label: config.office.label, value: registration.taxOfficeCode } : null,
      }}
      preparedOn={formatCalendarDate(todayIn(ctx.timezone), ctx.locale)}
      facts={wording.facts.map((fact) => ({ label: fact.label, answer: optionLabel(fact.code, worksheet.facts[fact.code]) }))}
      questions={wording.questions.map((question, index) => {
        const entry = worksheet.questions[question.code];
        return {
          number: index + 1,
          text: question.text,
          context: question.context,
          note: entry?.note ?? null,
          answer: entry?.answer ?? null,
          answeredOn: showDate(entry?.answeredOn ?? null),
        };
      })}
    />,
    wording.title,
  );
}
