"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgContext } from "@/modules/identity";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import {
  cancelPurchaseOrder,
  deletePurchaseOrderDraft,
  emailPurchaseOrder,
  issuePurchaseOrder,
  receivePurchaseOrder,
  savePurchaseOrderDraft,
  searchSuppliers,
} from "@/modules/purchasing";
import { env } from "@/shared/env";
import { normalizeSearch } from "@/shared/text/search";

export type SaveOrderResponse =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export type OrderCommandResponse =
  | { ok: true }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export type IssueOrderResponse =
  | { ok: true; number: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

const GONE = "This purchase order no longer exists.";
const FAILED = "Couldn't save. Please try again.";

const emailInput = z.object({ to: z.string().max(320), message: z.string().max(2000) });
const receiveInput = z.object({ receivedDate: z.string().max(20), note: z.string().max(2000) });

function revalidate(id?: string) {
  revalidatePath("/purchase-orders");
  if (id) revalidatePath(`/purchase-orders/${id}`);
}

/** Saves the form's latest content: creates the draft on the first save, then updates it. */
export async function savePurchaseOrderDraftAction(id: string | null, draft: unknown): Promise<SaveOrderResponse> {
  const ctx = await requireOrgContext();
  const result = await savePurchaseOrderDraft(ctx, id, draft, { locale: ctx.locale, units: ctx.market.units.options });
  if (result.ok) {
    revalidate(result.order.id);
    return { ok: true, id: result.order.id };
  }
  if ("errors" in result) return { ok: false, errors: result.errors };
  if ("notEditable" in result) {
    return { ok: false, error: "This purchase order was issued from somewhere else, so it can't be edited here. Reload to see it." };
  }
  return { ok: false, error: GONE };
}

export async function deletePurchaseOrderDraftAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await deletePurchaseOrderDraft(ctx, id);
  revalidate(id);
  if (result.ok) return { ok: true };
  return { ok: false, error: "notFound" in result ? GONE : "error" in result ? result.error : FAILED };
}

/** Issues a draft (the form saves it first), optionally emailing the supplier after the response. */
export async function issuePurchaseOrderAction(id: string, email: unknown): Promise<IssueOrderResponse> {
  const ctx = await requireOrgContext();
  const parsedEmail = email === null ? null : emailInput.safeParse(email);
  if (parsedEmail && !parsedEmail.success) return { ok: false, error: FAILED };
  const target = parsedEmail?.success ? parsedEmail.data : null;
  const result = await issuePurchaseOrder(ctx, id, {
    sender: { emailVerified: ctx.emailVerified },
    market: ctx.market,
    appUrl: env.APP_URL,
    email: target,
  });
  revalidate(id);
  if (result.ok) {
    if (target) flushOutboxAfterResponse();
    return { ok: true, number: result.number };
  }
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "notFound" in result ? GONE : result.error };
}

export async function emailPurchaseOrderAction(id: string, email: unknown): Promise<OrderCommandResponse> {
  const ctx = await requireOrgContext();
  const parsed = emailInput.safeParse(email);
  if (!parsed.success) return { ok: false, error: FAILED };
  const result = await emailPurchaseOrder(ctx, id, parsed.data, { market: ctx.market, appUrl: env.APP_URL, sender: { emailVerified: ctx.emailVerified } });
  if (result.ok) {
    flushOutboxAfterResponse();
    revalidate(id);
    return { ok: true };
  }
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "notFound" in result ? GONE : result.error };
}

export async function receivePurchaseOrderAction(id: string, input: unknown): Promise<OrderCommandResponse> {
  const ctx = await requireOrgContext();
  const parsed = receiveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: FAILED };
  const result = await receivePurchaseOrder(ctx, id, parsed.data);
  revalidate(id);
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "notFound" in result ? GONE : result.error };
}

export async function cancelPurchaseOrderAction(id: string, reason: string): Promise<OrderCommandResponse> {
  const ctx = await requireOrgContext();
  const result = await cancelPurchaseOrder(ctx, id, typeof reason === "string" ? reason : "");
  revalidate(id);
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "notFound" in result ? GONE : result.error };
}

export type SupplierChoice = { id: string; displayName: string; detail: string | null; email: string | null };

/** The supplier picker's results; the email is offered as the default place to send the order. */
export async function searchSuppliersAction(query: string): Promise<SupplierChoice[]> {
  const ctx = await requireOrgContext();
  const found = await searchSuppliers(ctx, normalizeSearch(query) ?? "");
  return found.slice(0, 8).map((s) => ({ id: s.id, displayName: s.displayName, detail: s.email, email: s.email }));
}
