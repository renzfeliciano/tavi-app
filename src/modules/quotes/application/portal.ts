import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { marketFor } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { recordShareLinkView, resolveShareLink, type SharedDocument } from "@/modules/documents";
import { enqueueEmail, quoteDecisionEmail } from "@/modules/notifications";
import { can } from "@/modules/authz";
import { listVerifiedEmails } from "@/modules/identity";
import { getLetterheadForSharedDocument, listMembers } from "@/modules/organizations";
import { type CalendarDate, todayIn } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { canonicalQuoteContent, parseQuoteDecision, quoteDecisionCheck, type RawQuoteDecision } from "../domain/decision";
import { transitionQuote } from "../domain/transitions";
import { quotes } from "../schema";
import { loadHeader, loadLines, type QuoteHeader, type QuoteLine } from "./quotes";

// What a customer does from a quote's link (§B.3, §G.4): opening it (VIEWED)
// and approving or declining it. The link is the authorization; there is no
// session, so these commands take the token, never an organization ID.

type SharedQuoteContent = Omit<QuoteHeader, "id"> & { lines: QuoteLine[] };

/**
 * SHA-256 of what the customer sees: the document's content, not its status
 * or timestamps. Stored with a decision so it binds to that exact content.
 */
export function sharedQuoteContentHash(quote: SharedQuoteContent): string {
  const content = {
    number: quote.number,
    revision: quote.revision,
    currency: quote.currency,
    taxMode: quote.taxMode,
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    customer: quote.customerSnapshot,
    notes: quote.notes,
    terms: quote.terms,
    totals: [quote.subtotalMinor, quote.discountTotalMinor, quote.taxTotalMinor, quote.totalMinor],
    lines: quote.lines.map((line) => ({
      description: line.description,
      unitLabel: line.unitLabel,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      discountKind: line.discountKind,
      discountValue: line.discountValue,
      taxRateName: line.taxRateName,
      taxRateBps: line.taxRateBps,
      totalMinor: line.totalMinor,
    })),
  };
  return createHash("sha256").update(canonicalQuoteContent(content)).digest("hex");
}

const customerEvent = (
  link: SharedDocument,
  action: AuditAction,
  metadata: Record<string, unknown>,
  visitor: { ipAddress?: string | null; userAgent?: string | null } = {},
) => ({
  action,
  actorType: "customer" as const,
  organizationId: link.organizationId,
  entityType: "quote",
  entityId: link.documentId,
  metadata,
  ipAddress: visitor.ipAddress ?? null,
  userAgent: visitor.userAgent ?? null,
});

async function lockSharedQuote(tx: Executor, token: string) {
  const link = await resolveShareLink(tx, token);
  if (!link || link.documentKind !== "quote") return null;
  const quote = await loadHeader(tx, link, link.documentId, true);
  if (!quote || quote.status === "DRAFT") return null;
  return { link, quote };
}

/**
 * Counts an open of a customer link; the first open of a sent quote marks it
 * VIEWED (§B.3). The business previewing its own quote never calls this.
 */
export async function recordSharedQuoteOpen(token: string, db: Database = getDb()): Promise<void> {
  await db.transaction(async (tx) => {
    const shared = await lockSharedQuote(tx, token);
    if (!shared) return;
    await recordShareLinkView(tx, token);
    const { link, quote } = shared;
    if (quote.status !== "SENT" || !transitionQuote(quote.status, "view").ok) return;
    await tx.update(quotes).set({ status: "VIEWED", viewedAt: sql`now()` }).where(eq(quotes.id, quote.id));
    await recordAuditEvent(tx, customerEvent(link, "quote.viewed", { number: quote.number, revision: quote.revision }));
  });
}

export type DecideSharedQuoteOptions = {
  /** The hash of the content the customer's page showed (sharedQuoteContentHash). */
  contentHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** The app's public address, for the link in the business's email. */
  appUrl: string;
  now?: Date;
};

export type DecideSharedQuoteResult =
  | { ok: true; status: "APPROVED" | "REJECTED" }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; reason: "expired"; validUntil: CalendarDate }
  | { ok: false; reason: "closed" | "changed" | "unavailable" };

const MAX_USER_AGENT = 500;

/** The customer approves or declines a quote from its link (§B.3, §G.4). */
export async function decideSharedQuote(
  token: string,
  raw: RawQuoteDecision,
  { contentHash, ipAddress, userAgent, appUrl, now = new Date() }: DecideSharedQuoteOptions,
  db: Database = getDb(),
): Promise<DecideSharedQuoteResult> {
  const parsed = parseQuoteDecision(raw);
  if (!parsed.ok) return parsed;
  const { decision } = parsed;
  const event = decision.kind;
  const visitor = { ipAddress, userAgent: userAgent?.slice(0, MAX_USER_AGENT) ?? null };

  return db.transaction(async (tx): Promise<DecideSharedQuoteResult> => {
    const shared = await lockSharedQuote(tx, token);
    if (!shared) return { ok: false, reason: "unavailable" };
    const { link, quote } = shared;
    const business = await getLetterheadForSharedDocument(link.organizationId, tx);
    if (!business) return { ok: false, reason: "unavailable" };

    const check = quoteDecisionCheck(quote, event, todayIn(business.timezone, now));
    if (!check.ok && check.reason === "expired") {
      // Expire it on the spot, as the daily job would have (§B.3).
      await tx.update(quotes).set({ status: "EXPIRED" }).where(eq(quotes.id, quote.id));
      await recordAuditEvent(tx, {
        ...customerEvent(link, "quote.expired", { number: quote.number, validUntil: quote.validUntil }),
        actorType: "system",
      });
      return { ok: false, reason: "expired", validUntil: quote.validUntil };
    }
    if (!check.ok) return { ok: false, reason: "closed" };

    const lines = await loadLines(tx, quote.id);
    const currentHash = sharedQuoteContentHash({ ...quote, lines });
    if (currentHash !== contentHash) return { ok: false, reason: "changed" };

    const status = decision.kind === "approve" ? "APPROVED" : "REJECTED";
    await tx
      .update(quotes)
      .set({
        status,
        decidedAt: sql`now()`,
        decisionName: decision.kind === "approve" ? decision.name : null,
        decisionNote: decision.kind === "reject" ? decision.reason : null,
        decisionContentHash: currentHash,
        decisionIp: visitor.ipAddress,
        decisionUserAgent: visitor.userAgent,
      })
      .where(eq(quotes.id, quote.id));
    await recordAuditEvent(
      tx,
      customerEvent(
        link,
        decision.kind === "approve" ? "quote.approved" : "quote.rejected",
        {
          number: quote.number,
          revision: quote.revision,
          totalMinor: quote.totalMinor,
          currency: quote.currency,
          contentHash: currentHash,
          ...(decision.kind === "approve" ? { name: decision.name } : { reason: decision.reason }),
        },
        visitor,
      ),
    );

    // Tell the business straight away (§I: this also flags a forwarded link).
    const market = marketFor(business.countryCode);
    // Everyone who can see quotes (by capability, never by role name).
    const members = await listMembers(link.organizationId, tx);
    const recipients = await listVerifiedEmails(
      members.filter((member) => can(member, "quotes.read")).map((member) => member.userId),
      tx,
    );
    for (const to of recipients) {
      await enqueueEmail(
        tx,
        quoteDecisionEmail({
          to,
          customerName: quote.customerSnapshot?.displayName ?? "Your customer",
          title: market.documents.quote.singular,
          number: quote.number ?? "",
          total: formatMoney(quote.totalMinor, quote.currency, { locale: business.locale }),
          decision,
          url: `${appUrl.replace(/\/$/, "")}/quotes/${quote.id}`,
        }),
        { organizationId: link.organizationId },
      );
    }
    return { ok: true, status };
  });
}
