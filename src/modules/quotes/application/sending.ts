import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { formatAddressLines, type MarketProfile } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import {
  allocateDocumentNumber,
  createShareLink,
  resolveShareLink,
  revokeShareLinks,
} from "@/modules/documents";
import { documentLinkEmail, enqueueEmail } from "@/modules/notifications";
import {
  type DocumentLetterhead,
  getBusinessProfile,
  getDocumentSettings,
  getLetterheadForSharedDocument,
} from "@/modules/organizations";
import { addDays, formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { quoteLinkExpiresAt, readinessToSend } from "../domain/sending";
import { transitionQuote } from "../domain/transitions";
import { type CustomerSnapshot, quotes } from "../schema";
import { audit, headerColumns, loadHeader, loadLines, type QuoteCommandResult, type QuoteDetail } from "./quotes";

// Sending a quote and what follows (§B.3): numbering at first send, the
// customer snapshot, the customer's link (and optional email), revising,
// cancelling, and reading a quote from its link.

export type SendQuoteOptions = {
  /** The signed-in sender: sending needs a confirmed email address (§D). */
  sender: { emailVerified: boolean };
  market: MarketProfile;
  /** The app's public address, for the customer's link. */
  appUrl: string;
  /** Email it to the customer, or null to share the link yourself. */
  email: { to: string; message: string } | null;
  now?: Date;
};

export type SendQuoteResult =
  | { ok: true; number: string; url: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string }
  | { ok: false; notFound: true };

export type QuoteLinkResult = { ok: true; url: string } | { ok: false; error: string } | { ok: false; notFound: true };

const linkUrl = (appUrl: string, token: string) => `${appUrl.replace(/\/$/, "")}/q/${token}`;
const quoteDocument = (actor: OrgActor, id: string) => ({
  organizationId: actor.organizationId,
  documentKind: "quote" as const,
  documentId: id,
});

export async function sendQuote(
  actor: OrgActor,
  id: string,
  { sender, market, appUrl, email, now = new Date() }: SendQuoteOptions,
  db: Database = getDb(),
): Promise<SendQuoteResult> {
  assertCan(actor, "quotes.send");
  if (!sender.emailVerified) {
    return { ok: false, error: "Confirm your email address before sending. We sent you a link when you signed up." };
  }
  const emailTo = email?.to.trim().toLowerCase() ?? null;
  if (email && !z.email().safeParse(emailTo).success) {
    return { ok: false, errors: { emailTo: "Enter a valid email address." } };
  }

  const current = await loadHeader(db, actor, id);
  if (!current) return { ok: false, notFound: true };
  if (!transitionQuote(current.status, "send").ok) {
    return { ok: false, error: "This quote was already sent. Revise it to make changes and send it again." };
  }
  const [settings, lines, profile] = await Promise.all([
    getDocumentSettings(actor, db),
    loadLines(db, current.id),
    getBusinessProfile(actor, db),
  ]);
  const problems = readinessToSend(
    { customerId: current.customerId, lineCount: lines.length, validUntil: current.validUntil },
    todayIn(settings.timezone, now),
  );
  if (Object.keys(problems).length > 0) return { ok: false, errors: problems };
  const customer = current.customerId ? await getCustomer(actor, current.customerId, db) : null;
  if (!customer) return { ok: false, errors: { customerId: "Choose a customer before sending." } };

  // The customer as they are now, kept with the quote: later edits to the
  // customer never change what was sent (§B.1).
  const snapshot: CustomerSnapshot = {
    displayName: customer.displayName,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    addressLines: formatAddressLines(customer, market),
    taxId: customer.taxId,
  };

  const outcome = await db.transaction(async (tx) => {
    const locked = await loadHeader(tx, actor, id, true);
    if (!locked || locked.status !== "DRAFT") return null;
    const number = locked.number ?? (await allocateDocumentNumber(tx, actor.organizationId, "quote")).number;
    await tx
      .update(quotes)
      .set({ status: "SENT", number, customerSnapshot: snapshot, sentAt: sql`now()` })
      .where(eq(quotes.id, locked.id));
    await revokeShareLinks(tx, quoteDocument(actor, locked.id));
    const token = await createShareLink(tx, {
      ...quoteDocument(actor, locked.id),
      expiresAt: quoteLinkExpiresAt(locked.validUntil),
      createdBy: actor.userId,
    });
    const url = linkUrl(appUrl, token);
    await audit(tx, actor, "quote.sent", locked.id, {
      number,
      revision: locked.revision,
      totalMinor: locked.totalMinor,
      currency: locked.currency,
      channel: email ? "email" : "link",
    });
    if (email && emailTo) {
      await enqueueEmail(
        tx,
        documentLinkEmail({
          to: emailTo,
          businessName: profile.name,
          businessEmail: profile.email,
          title: market.documents.quote.singular,
          number,
          total: formatMoney(locked.totalMinor, locked.currency, { locale: settings.locale }),
          dueLine: `Valid until ${formatCalendarDate(locked.validUntil, settings.locale)}`,
          message: email.message,
          url,
          action: "View the quote",
        }),
        { organizationId: actor.organizationId },
      );
    }
    return { number, url };
  });

  if (!outcome) return { ok: false, error: "This quote was already sent. Revise it to make changes and send it again." };
  return { ok: true, ...outcome };
}

/** Another link to a sent quote (e.g. to paste into a chat), leaving earlier links open. */
export async function createQuoteLink(
  actor: OrgActor,
  id: string,
  { appUrl }: { appUrl: string },
  db: Database = getDb(),
): Promise<QuoteLinkResult> {
  assertCan(actor, "quotes.send");
  return db.transaction(async (tx): Promise<QuoteLinkResult> => {
    const quote = await loadHeader(tx, actor, id, true);
    if (!quote) return { ok: false, notFound: true };
    if (quote.status === "DRAFT") return { ok: false, error: "Send the quote first; its link opens then." };
    if (quote.status === "CANCELLED") return { ok: false, error: "This quote was cancelled, so it has no link." };
    const token = await createShareLink(tx, {
      ...quoteDocument(actor, quote.id),
      expiresAt: quoteLinkExpiresAt(quote.validUntil),
      createdBy: actor.userId,
    });
    await audit(tx, actor, "quote.link_created", quote.id, { number: quote.number });
    return { ok: true, url: linkUrl(appUrl, token) };
  });
}

/**
 * Reopens a sent quote for changes as its next revision (§B.3): same number,
 * a fresh valid-until date, the live customer again, and every old link
 * closed so a stale page can't be approved.
 */
export async function reviseQuote(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<QuoteCommandResult> {
  assertCan(actor, "quotes.write");
  const settings = await getDocumentSettings(actor, db);
  return db.transaction(async (tx): Promise<QuoteCommandResult> => {
    const quote = await loadHeader(tx, actor, id, true);
    if (!quote) return { ok: false, notFound: true };
    if (!transitionQuote(quote.status, "revise").ok) return { ok: false, error: "Only a sent quote can be revised." };
    const today = todayIn(settings.timezone, now);
    await tx
      .update(quotes)
      .set({
        status: "DRAFT",
        revision: quote.revision + 1,
        issueDate: today,
        validUntil: addDays(today, settings.quoteValidityDays),
        customerSnapshot: null,
        viewedAt: null,
        decidedAt: null,
        decisionName: null,
        decisionNote: null,
        decisionContentHash: null,
        decisionIp: null,
        decisionUserAgent: null,
      })
      .where(eq(quotes.id, quote.id));
    await revokeShareLinks(tx, quoteDocument(actor, quote.id));
    await audit(tx, actor, "quote.revised", quote.id, { number: quote.number, fromRevision: quote.revision });
    return { ok: true };
  });
}

const MAX_REASON = 500;

/** Calls a quote off (§B.3). Its number stays used; its links close. */
export async function cancelQuote(
  actor: OrgActor,
  id: string,
  reason: string,
  db: Database = getDb(),
): Promise<QuoteCommandResult> {
  assertCan(actor, "quotes.write");
  const note = reason.trim().slice(0, MAX_REASON) || null;
  return db.transaction(async (tx): Promise<QuoteCommandResult> => {
    const quote = await loadHeader(tx, actor, id, true);
    if (!quote) return { ok: false, notFound: true };
    if (!transitionQuote(quote.status, "cancel").ok) return { ok: false, error: "This quote can't be cancelled." };
    // An approved quote can be cancelled only until it becomes an invoice (§B.3).
    if (quote.convertedInvoiceId) {
      return { ok: false, error: "This quote is already an invoice. Void or cancel the invoice instead." };
    }
    await tx
      .update(quotes)
      .set({ status: "CANCELLED", cancelledAt: sql`now()`, cancelReason: note })
      .where(eq(quotes.id, quote.id));
    await revokeShareLinks(tx, quoteDocument(actor, quote.id));
    await audit(tx, actor, "quote.cancelled", quote.id, { number: quote.number, reason: note });
    return { ok: true };
  });
}

export type SharedQuote = {
  quote: Omit<QuoteDetail, "customer">;
  business: DocumentLetterhead;
  countryCode: string;
  locale: string;
  organizationId: string;
};

/**
 * A quote opened from its customer link. The link is the authorization: an
 * unknown, revoked or expired token (or a link to anything but a quote)
 * finds nothing. Drafts are never shown.
 */
export async function getSharedQuote(token: string, db: Database = getDb()): Promise<SharedQuote | null> {
  const link = await resolveShareLink(db, token);
  if (!link || link.documentKind !== "quote") return null;
  const [header] = await db
    .select(headerColumns)
    .from(quotes)
    .where(and(eq(quotes.id, link.documentId), eq(quotes.organizationId, link.organizationId)));
  if (!header || header.status === "DRAFT") return null;
  const [lines, business] = await Promise.all([
    loadLines(db, header.id),
    getLetterheadForSharedDocument(link.organizationId, db),
  ]);
  if (!business) return null;
  return {
    quote: { ...header, lines },
    business,
    countryCode: business.countryCode,
    locale: business.locale,
    organizationId: link.organizationId,
  };
}
