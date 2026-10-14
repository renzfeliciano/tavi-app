"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/modules/identity";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import { env } from "@/shared/env";
import { deleteVoidedPayment, type RawPayment, recordPayment, voidPayment } from "@/modules/payments";

const GONE = "This invoice no longer exists.";

export type RecordPaymentResponse =
  | { ok: true; receiptNumber: string; paymentId: string; paidInFull: boolean }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export async function recordPaymentAction(
  invoiceId: string,
  raw: RawPayment,
  recipients: string[],
  idempotencyKey?: string,
): Promise<RecordPaymentResponse> {
  const ctx = await requireOrgContext();
  const result = await recordPayment(ctx, invoiceId, raw, { recipients, market: ctx.market, idempotencyKey, appUrl: env.APP_URL });
  revalidatePath("/invoices");
  revalidatePath("/payments");
  if (result.ok) {
    if (recipients.length > 0) flushOutboxAfterResponse();
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

/** The owner: moves a void payment to the recycle bin. */
export async function deletePaymentAction(paymentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await deleteVoidedPayment(ctx, paymentId);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/recycle-bin");
  if (result.ok) return { ok: true };
  return { ok: false, error: "error" in result ? result.error : "This payment no longer exists." };
}
