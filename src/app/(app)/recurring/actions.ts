"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/modules/identity";
import { createSchedule, endSchedule, pauseSchedule, resumeSchedule, updateSchedule } from "@/modules/invoices";
import { todayIn } from "@/shared/dates/calendar";

export type CreateScheduleResponse = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

/** "Repeat this" on an issued bill: the schedule copies its customer, items and terms. Bound to the bill's id by the page. */
export async function createScheduleAction(sourceInvoiceId: string, input: unknown): Promise<CreateScheduleResponse> {
  const ctx = await requireOrgContext();
  const result = await createSchedule(ctx, sourceInvoiceId, input, { today: todayIn(ctx.timezone) });
  if (result.ok) {
    revalidatePath("/recurring");
    return { ok: true, id: result.id };
  }
  if ("errors" in result) return { ok: false, errors: result.errors };
  if ("notRepeatable" in result) {
    return { ok: false, errors: { form: "A voided or cancelled statement can't be repeated, and neither can a draft." } };
  }
  return { ok: false, errors: { form: "This statement no longer exists, or it has no customer to bill." } };
}

type CommandResponse = { ok: true } | { ok: false; error: string };

const GONE = "This schedule no longer exists.";
const changed = (status: string) =>
  status === "ended" ? "This schedule has already ended." : "This schedule was changed somewhere else. Reload to see it.";

function toResponse(result: { ok: true } | { ok: false; notFound: true } | { ok: false; wrongState: string }): CommandResponse {
  if (result.ok) return { ok: true };
  return { ok: false, error: "notFound" in result ? GONE : changed(result.wrongState) };
}

export async function pauseScheduleAction(id: string): Promise<CommandResponse> {
  const ctx = await requireOrgContext();
  const result = toResponse(await pauseSchedule(ctx, id));
  revalidatePath("/recurring");
  return result;
}

export async function resumeScheduleAction(id: string): Promise<CommandResponse> {
  const ctx = await requireOrgContext();
  const result = toResponse(await resumeSchedule(ctx, id, { today: todayIn(ctx.timezone) }));
  revalidatePath("/recurring");
  return result;
}

export async function endScheduleAction(id: string): Promise<CommandResponse> {
  const ctx = await requireOrgContext();
  const result = toResponse(await endSchedule(ctx, id));
  revalidatePath("/recurring");
  return result;
}

/** The edit form: timing, end rule, notes and terms for the statements still to come. */
export async function updateScheduleAction(
  id: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const ctx = await requireOrgContext();
  const result = await updateSchedule(ctx, id, input, { today: todayIn(ctx.timezone) });
  revalidatePath("/recurring");
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, errors: { form: "notFound" in result ? GONE : changed(result.wrongState) } };
}
