"use server";

import { revalidatePath } from "next/cache";
import { parseDelivery } from "@/modules/documents";
import { requireOrgContext } from "@/modules/identity";
import { flushOutboxAfterResponse } from "@/modules/notifications";
import {
  cancelQuote,
  createQuoteLink,
  deleteDraftQuote,
  reviseQuote,
  saveQuoteDraft,
  sendQuote,
} from "@/modules/quotes";
import { env } from "@/shared/env";
import type { SaveDraftResponse, SendDocumentResponse } from "../_documents/editor-types";


/** Autosave: creates the draft on the first save, then updates it. */
export async function saveQuoteDraftAction(id: string | null, draft: unknown): Promise<SaveDraftResponse> {
  const ctx = await requireOrgContext();
  const result = await saveQuoteDraft(ctx, id, draft, { locale: ctx.locale, units: ctx.market.units.options });
  // No revalidatePath: quote pages render per request anyway, and autosave
  // fires every few seconds, so a refresh per save would only cost renders.
  if (result.ok) return { ok: true, id: result.quote.id, savedAt: Date.now() };
  if ("errors" in result) return { ok: false, errors: result.errors };
  if ("notEditable" in result) {
    return { ok: false, error: "This quote was sent from somewhere else, so it can't be edited here. Reload to see it." };
  }
  return { ok: false, error: "This quote no longer exists." };
}

export async function deleteDraftQuoteAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await deleteDraftQuote(ctx, id);
  revalidatePath("/quotes");
  if (result.ok) return { ok: true };
  return { ok: false, error: "notFound" in result ? "This quote no longer exists." : result.error };
}

/**
 * Checks the delivery, saves the editor's latest content, then sends it: by email, or by marking it
 * sent and returning the link to paste. Emails go out after the response.
 */
export async function sendQuoteAction(
  id: string | null,
  draft: unknown,
  delivery: unknown,
): Promise<SendDocumentResponse> {
  const ctx = await requireOrgContext();
  const parsedDelivery = parseDelivery(delivery);
  if (!parsedDelivery.ok) return parsedDelivery;
  const { email } = parsedDelivery;
  const saved = await saveQuoteDraft(ctx, id, draft, { locale: ctx.locale, units: ctx.market.units.options });
  if (!saved.ok) {
    if ("errors" in saved) return { ok: false, errors: saved.errors };
    return { ok: false, error: "notEditable" in saved ? "This quote was already sent." : "This quote no longer exists." };
  }
  const sent = await sendQuote(ctx, saved.quote.id, {
    sender: { emailVerified: ctx.emailVerified },
    market: ctx.market,
    appUrl: env.APP_URL,
    email,
  });
  revalidatePath("/quotes");
  if (!sent.ok) {
    if ("errors" in sent) return { ok: false, errors: sent.errors };
    return { ok: false, error: "error" in sent ? sent.error : "This quote no longer exists." };
  }
  if (email) flushOutboxAfterResponse();
  return { ok: true, id: saved.quote.id, number: sent.number, url: sent.url, emailedTo: email?.to ?? null };
}

type LinkResponse = { ok: true; url: string } | { ok: false; error: string };
type CommandResponse = { ok: true } | { ok: false; error: string };

const GONE = "This quote no longer exists.";

export async function createQuoteLinkAction(id: string): Promise<LinkResponse> {
  const ctx = await requireOrgContext();
  const result = await createQuoteLink(ctx, id, { appUrl: env.APP_URL });
  if (result.ok) return { ok: true, url: result.url };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

export async function reviseQuoteAction(id: string): Promise<CommandResponse> {
  const ctx = await requireOrgContext();
  const result = await reviseQuote(ctx, id);
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  if (result.ok) return { ok: true };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

export async function cancelQuoteAction(id: string, reason: string): Promise<CommandResponse> {
  const ctx = await requireOrgContext();
  const result = await cancelQuote(ctx, id, reason);
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  if (result.ok) return { ok: true };
  return { ok: false, error: "error" in result ? result.error : GONE };
}
