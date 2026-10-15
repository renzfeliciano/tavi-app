import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCustomer } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { getSchedule } from "@/modules/invoices";
import { compareDates, todayIn } from "@/shared/dates/calendar";
import { updateScheduleAction } from "../../actions";
import { ScheduleForm } from "../../_components/schedule-form";

export const metadata: Metadata = { title: "Edit recurring statement" };

export default async function EditSchedulePage({ params }: PageProps<"/recurring/[id]/edit">) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const schedule = await getSchedule(ctx, id);
  if (!schedule) notFound();
  // An ended schedule has nothing left to change.
  if (schedule.status === "ended") redirect(`/recurring/${id}`);
  const customer = await getCustomer(ctx, schedule.customerId);
  const today = todayIn(ctx.timezone);
  // A next date already past (a paused schedule left alone) can't be kept: it starts again from today.
  const nextOn = compareDates(schedule.nextRunOn, today) < 0 ? today : schedule.nextRunOn;

  return (
    <>
      <BackLink href={`/recurring/${id}` as Route}>{customer?.displayName ?? "Recurring statement"}</BackLink>
      <PageHeader title="Edit schedule" description="Changes apply to the next statement onward. The ones already made stay as they are." />
      <div className="mt-8 max-w-3xl">
        <ScheduleForm
          id={id}
          update={updateScheduleAction.bind(null, id)}
          initial={{
            recurrence: {
              frequency: schedule.frequency,
              anchorDay: String(schedule.anchorDay),
              anchorMonth: String(schedule.anchorMonth ?? Number(nextOn.slice(5, 7))),
              startOn: nextOn,
              endsOn: schedule.endsOn ?? "",
              maxDrafts: schedule.maxDrafts === null ? "" : String(schedule.maxDrafts),
            },
            termsDays: String(schedule.termsDays),
            notes: schedule.notes ?? "",
            terms: schedule.terms ?? "",
          }}
        />
      </div>
    </>
  );
}
