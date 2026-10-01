"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/modules/identity";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import { type RawPayment, recordPayment, voidPayment } from "@/modules/payments";

const GONE = "This invoice no longer exists.";

export type RecordPaymentResponse =
  | { ok: true; receiptNumber: string; paymentId: string; paidInFull: boolean }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export async function recordPaymentAction(
  invoiceId: string,
  raw: RawPayment,
  acknowledge: boolean,
): Promise<RecordPaymentResponse> {
  const ctx = await requireOrgContext();
  const result = await recordPayment(ctx, invoiceId, raw, { acknowledge, market: ctx.market });
  revalidatePath("/invoices");
  revalidatePath("/payments");
  if (result.ok) {
    if (acknowledge) flushOutboxAfterResponse();
    return { ok: true, receiptNumber: result.receiptNumber, paymentId: result.paymentId, paidInFull: result.status === "PAID" };
  }
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

export async function voidPaymentAction(
  paymentId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await voidPayment(ctx, paymentId, reason);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : "This payment no longer exists." };
}
