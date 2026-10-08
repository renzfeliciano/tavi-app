"use server";

import { revalidatePath } from "next/cache";
import { parseDelivery } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import {
  cancelInvoice,
  convertQuoteToInvoice,
  createInvoiceLink,
  deleteDraftInvoice,
  editIssuedInvoice,
  issueInvoice,
  saveInvoiceDraft,
  voidAndDuplicateInvoice,
  voidInvoice,
} from "@/modules/invoices";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import { env } from "@/shared/env";
import type { SaveDraftResponse, SaveIssuedResponse, SendDocumentResponse } from "../_documents/editor-types";

const GONE = "This invoice no longer exists.";

/** Autosave: creates the draft on the first save, then updates it. */
export async function saveInvoiceDraftAction(id: string | null, draft: unknown): Promise<SaveDraftResponse> {
  const ctx = await requireOrgContext();
  const result = await saveInvoiceDraft(ctx, id, draft, { locale: ctx.locale, qualifiedDiscounts: ctx.market.qualifiedDiscounts });
  // No revalidatePath: invoice pages render per request anyway (see the quote autosave).
  if (result.ok) return { ok: true, id: result.invoice.id, savedAt: Date.now() };
  if ("errors" in result) return { ok: false, errors: result.errors };
  if ("notEditable" in result) {
    return { ok: false, error: "This invoice was sent from somewhere else, so it can't be edited here. Reload to see it." };
  }
  return { ok: false, error: GONE };
}

export async function deleteDraftInvoiceAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await deleteDraftInvoice(ctx, id);
  revalidatePath("/invoices");
  if (result.ok) {
    if (result.sourceQuoteId) revalidatePath(`/quotes/${result.sourceQuoteId}`);
    return { ok: true };
  }
  return { ok: false, error: "notFound" in result ? GONE : result.error };
}

/**
 * Checks the delivery, saves the editor's latest content, then issues it: by email, or by marking
 * it sent and returning the link to paste. Emails go out after the response.
 */
export async function sendInvoiceAction(
  id: string | null,
  draft: unknown,
  delivery: unknown,
): Promise<SendDocumentResponse> {
  const ctx = await requireOrgContext();
  const parsedDelivery = parseDelivery(delivery);
  if (!parsedDelivery.ok) return parsedDelivery;
  const { email } = parsedDelivery;
  const saved = await saveInvoiceDraft(ctx, id, draft, { locale: ctx.locale, qualifiedDiscounts: ctx.market.qualifiedDiscounts });
  if (!saved.ok) {
    if ("errors" in saved) return { ok: false, errors: saved.errors };
    return { ok: false, error: "notEditable" in saved ? "This invoice was already sent." : GONE };
  }
  const sent = await issueInvoice(ctx, saved.invoice.id, {
    sender: { emailVerified: ctx.emailVerified },
    market: ctx.market,
    appUrl: env.APP_URL,
    email,
  });
  revalidatePath("/invoices");
  if (!sent.ok) {
    if ("errors" in sent) return { ok: false, errors: sent.errors };
    return { ok: false, error: "error" in sent ? sent.error : GONE };
  }
  if (email) flushOutboxAfterResponse();
  return {
    ok: true,
    id: saved.invoice.id,
    number: sent.number,
    url: sent.url,
    emailedTo: email?.to ?? null,
  };
}

export async function createInvoiceLinkAction(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await createInvoiceLink(ctx, id, { appUrl: env.APP_URL });
  if (result.ok) return { ok: true, url: result.url };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

/** An approved quote → a draft invoice to review and send (§B.4). */
export async function convertQuoteToInvoiceAction(
  quoteId: string,
): Promise<{ ok: true; invoiceId: string; created: boolean } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await convertQuoteToInvoice(ctx, quoteId);
  revalidatePath("/invoices");
  revalidatePath(`/quotes/${quoteId}`);
  if (result.ok) return result;
  return { ok: false, error: "error" in result ? result.error : "This quote no longer exists." };
}

type CorrectionResponse = { ok: true } | { ok: false; errors: Record<string, string> } | { ok: false; error: string };

const closedResponse = (result: Awaited<ReturnType<typeof voidInvoice>>): CorrectionResponse => {
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
};

/** Saves changes to a sent, unpaid invoice as its next revision (D7). */
export async function editIssuedInvoiceAction(id: string, draft: unknown): Promise<SaveIssuedResponse> {
  const ctx = await requireOrgContext();
  const result = await editIssuedInvoice(ctx, id, draft, { locale: ctx.locale, qualifiedDiscounts: ctx.market.qualifiedDiscounts });
  revalidatePath("/invoices");
  if (result.ok) return result;
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

export async function voidInvoiceAction(id: string, reason: string): Promise<CorrectionResponse> {
  const ctx = await requireOrgContext();
  const result = closedResponse(await voidInvoice(ctx, id, reason));
  revalidatePath("/invoices");
  return result;
}

export async function cancelInvoiceAction(id: string, reason: string): Promise<CorrectionResponse> {
  const ctx = await requireOrgContext();
  const result = closedResponse(await cancelInvoice(ctx, id, reason));
  revalidatePath("/invoices");
  return result;
}

export async function voidAndDuplicateInvoiceAction(
  id: string,
  reason: string,
): Promise<{ ok: true; duplicateId: string } | { ok: false; errors: Record<string, string> } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await voidAndDuplicateInvoice(ctx, id, reason);
  revalidatePath("/invoices");
  if (result.ok) return result;
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
}
