"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/modules/identity";
import {
  convertQuoteToInvoice,
  createInvoiceLink,
  deleteDraftInvoice,
  issueInvoice,
  saveInvoiceDraft,
} from "@/modules/invoices";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import { env } from "@/shared/env";
import type { Delivery, SaveDraftResponse, SendDocumentResponse } from "../_documents/editor-types";

const GONE = "This invoice no longer exists.";

/** Autosave: creates the draft on the first save, then updates it. */
export async function saveInvoiceDraftAction(id: string | null, draft: unknown): Promise<SaveDraftResponse> {
  const ctx = await requireOrgContext();
  const result = await saveInvoiceDraft(ctx, id, draft, { locale: ctx.locale });
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
 * Saves the editor's latest content, then issues it: by email, or by marking
 * it sent and returning the link to paste. Emails go out after the response.
 */
export async function sendInvoiceAction(
  id: string | null,
  draft: unknown,
  delivery: Delivery,
): Promise<SendDocumentResponse> {
  const ctx = await requireOrgContext();
  const saved = await saveInvoiceDraft(ctx, id, draft, { locale: ctx.locale });
  if (!saved.ok) {
    if ("errors" in saved) return { ok: false, errors: saved.errors };
    return { ok: false, error: "notEditable" in saved ? "This invoice was already sent." : GONE };
  }
  const email = delivery.mode === "email" ? { to: delivery.to, message: delivery.message } : null;
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
    emailedTo: email?.to.trim().toLowerCase() ?? null,
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
