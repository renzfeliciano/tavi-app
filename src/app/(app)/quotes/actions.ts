"use server";

import { revalidatePath } from "next/cache";
import { formatAddressLines } from "@/config/markets";
import { searchLineSources } from "@/modules/catalog";
import { getCustomer, listCustomers } from "@/modules/customers";
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
import { normalizeSearch } from "@/shared/text/search";
import type { CustomerChoice, LineSourceChoice } from "./_lib/editor-types";

export type SaveDraftResponse =
  | { ok: true; id: string; savedAt: number }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

/** Autosave: creates the draft on the first save, then updates it. */
export async function saveQuoteDraftAction(id: string | null, draft: unknown): Promise<SaveDraftResponse> {
  const ctx = await requireOrgContext();
  const result = await saveQuoteDraft(ctx, id, draft, { locale: ctx.locale });
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

/** Active customers for the quote's customer picker. */
export async function searchCustomersAction(query: string): Promise<CustomerChoice[]> {
  const ctx = await requireOrgContext();
  const { customers } = await listCustomers(ctx, { search: normalizeSearch(query) });
  return customers.slice(0, 8).map((c) => ({ id: c.id, displayName: c.displayName, detail: c.company ?? c.email ?? c.phone }));
}

/** A customer as the document shows them, plus their preferred currency. */
export async function customerForDocumentAction(id: string) {
  const ctx = await requireOrgContext();
  const customer = await getCustomer(ctx, id);
  if (!customer) return null;
  return {
    id: customer.id,
    currency: customer.currency,
    email: customer.email,
    party: {
      name: customer.displayName,
      subtitle: customer.company,
      addressLines: formatAddressLines(customer, ctx.market),
      contactLines: [customer.email, customer.phone].filter((line): line is string => Boolean(line)),
      taxId: customer.taxId ? { label: ctx.market.taxId.label, value: customer.taxId } : null,
    },
  };
}

/** Products and services for the line-item picker. */
export async function searchLineSourcesAction(query: string): Promise<LineSourceChoice[]> {
  const ctx = await requireOrgContext();
  const { products, services } = await searchLineSources(ctx, normalizeSearch(query));
  return [...services, ...products].map((s) => ({
    key: `${s.kind}:${s.id}`,
    kind: s.kind,
    id: s.id,
    name: s.name,
    description: s.description,
    sku: s.sku,
    unitLabel: s.unitLabel,
    unitPriceMinor: s.unitPriceMinor,
    currency: s.currency,
    taxRateId: s.taxRateId,
  }));
}

export type SendQuoteResponse =
  | { ok: true; id: string; number: string; url: string; emailedTo: string | null }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

/**
 * Saves the editor's latest content, then sends it: by email, or by marking it
 * sent and returning the link to paste. Emails go out after the response.
 */
export async function sendQuoteAction(
  id: string | null,
  draft: unknown,
  delivery: { mode: "email"; to: string; message: string } | { mode: "link" },
): Promise<SendQuoteResponse> {
  const ctx = await requireOrgContext();
  const saved = await saveQuoteDraft(ctx, id, draft, { locale: ctx.locale });
  if (!saved.ok) {
    if ("errors" in saved) return { ok: false, errors: saved.errors };
    return { ok: false, error: "notEditable" in saved ? "This quote was already sent." : "This quote no longer exists." };
  }
  const email = delivery.mode === "email" ? { to: delivery.to, message: delivery.message } : null;
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
  return { ok: true, id: saved.quote.id, number: sent.number, url: sent.url, emailedTo: email?.to.trim().toLowerCase() ?? null };
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
