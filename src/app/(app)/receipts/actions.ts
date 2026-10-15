"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CustomerChoice } from "../_documents/editor-types";
import { listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import { emailReceipt, issueReceipt, voidReceipt } from "@/modules/payments";
import { env } from "@/shared/env";
import { normalizeSearch } from "@/shared/text/search";

export type IssueReceiptResponse =
  | { ok: true; id: string; receiptNumber: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

const FAILED = "Couldn't save. Please try again.";

const issueInput = z.object({
  raw: z.object({
    customerId: z.string(),
    kind: z.string(),
    payer: z.string(),
    amount: z.string(),
    receivedOn: z.string(),
    method: z.string(),
    reference: z.string(),
    institution: z.string(),
    paidTime: z.string(),
    chequeDate: z.string(),
    purpose: z.string(),
    notes: z.string(),
  }),
  recipients: z.array(z.string()).max(20),
  idempotencyKey: z.string().max(100),
});
export type IssueReceiptInput = z.input<typeof issueInput>;

/** Makes a receipt. A repeat of the same attempt (same key) returns the receipt already made. */
export async function issueReceiptAction(input: IssueReceiptInput): Promise<IssueReceiptResponse> {
  const ctx = await requireOrgContext();
  const parsed = issueInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: FAILED };
  const { raw, recipients, idempotencyKey } = parsed.data;
  const result = await issueReceipt(ctx, raw, { recipients, market: ctx.market, idempotencyKey, appUrl: env.APP_URL });
  if (!result.ok) {
    if ("errors" in result) return { ok: false, errors: result.errors };
    return { ok: false, error: "error" in result ? result.error : FAILED };
  }
  revalidatePath("/receipts");
  if (recipients.length > 0) flushOutboxAfterResponse();
  return { ok: true, id: result.receiptId, receiptNumber: result.receiptNumber };
}

export type ReceiptCustomerChoice = CustomerChoice & { email: string | null };

/** The customer picker's results; the email is offered as the default place to send the copy. */
export async function searchReceiptCustomersAction(query: string): Promise<ReceiptCustomerChoice[]> {
  const ctx = await requireOrgContext();
  const { customers } = await listCustomers(ctx, { search: normalizeSearch(query) });
  return customers.slice(0, 8).map((c) => ({ id: c.id, displayName: c.displayName, detail: c.company ?? c.email ?? c.phone, email: c.email }));
}

const GONE = "This receipt no longer exists.";

export async function voidReceiptAction(
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await voidReceipt(ctx, id, typeof reason === "string" ? reason : "");
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

export async function emailReceiptAction(
  id: string,
  recipients: string[],
): Promise<{ ok: true; queued: number } | { ok: false; errors: Record<string, string> } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const list = z.array(z.string()).max(20).safeParse(recipients);
  if (!list.success) return { ok: false, error: FAILED };
  const result = await emailReceipt(ctx, id, list.data, { market: ctx.market, appUrl: env.APP_URL });
  if (result.ok) {
    flushOutboxAfterResponse();
    return { ok: true, queued: result.queued };
  }
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
}
