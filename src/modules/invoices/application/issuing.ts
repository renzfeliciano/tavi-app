import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { formatAddressLines, type MarketProfile } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import {
  allocateDocumentNumber,
  createShareLink,
  recordShareLinkView,
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
import type { CustomerSnapshot } from "@/modules/quotes";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { invoiceLinkExpiresAt, issuedInvoiceStatus, readinessToIssue } from "../domain/issuing";
import { transitionInvoice } from "../domain/transitions";
import { invoices } from "../schema";
import { audit, headerColumns, type InvoiceDetail, loadHeader, loadLines } from "./invoices";

// Issuing an invoice and its customer link (§B.4): numbering, the customer
// and payment-instruction snapshots, the link (and optional email), and
// reading an invoice from its link.

export type IssueInvoiceOptions = {
  /** The signed-in sender: sending needs a confirmed email address (§D). */
  sender: { emailVerified: boolean };
  market: MarketProfile;
  /** The app's public address, for the customer's link. */
  appUrl: string;
  /** Email it to the customer, or null to share the link yourself. */
  email: { to: string; message: string } | null;
  now?: Date;
};

export type IssueInvoiceResult =
  | { ok: true; number: string; url: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string }
  | { ok: false; notFound: true };

export type InvoiceLinkResult = { ok: true; url: string } | { ok: false; error: string } | { ok: false; notFound: true };

const ALREADY_SENT = "This invoice was already sent.";
const linkUrl = (appUrl: string, token: string) => `${appUrl.replace(/\/$/, "")}/i/${token}`;
const invoiceDocument = (actor: Pick<OrgActor, "organizationId">, id: string) => ({
  organizationId: actor.organizationId,
  documentKind: "invoice" as const,
  documentId: id,
});

export async function issueInvoice(
  actor: OrgActor,
  id: string,
  { sender, market, appUrl, email, now = new Date() }: IssueInvoiceOptions,
  db: Database = getDb(),
): Promise<IssueInvoiceResult> {
  assertCan(actor, "invoices.send");
  if (!sender.emailVerified) {
    return { ok: false, error: "Confirm your email address before sending. We sent you a link when you signed up." };
  }
  const emailTo = email?.to.trim().toLowerCase() ?? null;
  if (email && !z.email().safeParse(emailTo).success) {
    return { ok: false, errors: { emailTo: "Enter a valid email address." } };
  }

  const current = await loadHeader(db, actor, id);
  if (!current) return { ok: false, notFound: true };
  if (!transitionInvoice(current.status, "issue").ok) return { ok: false, error: ALREADY_SENT };
  const [settings, lines, profile] = await Promise.all([
    getDocumentSettings(actor, db),
    loadLines(db, current.id),
    getBusinessProfile(actor, db),
  ]);
  const problems = readinessToIssue({ customerId: current.customerId, lineCount: lines.length });
  if (Object.keys(problems).length > 0) return { ok: false, errors: problems };
  const customer = current.customerId ? await getCustomer(actor, current.customerId, db) : null;
  if (!customer) return { ok: false, errors: { customerId: "Choose a customer before sending." } };

  // The customer as they are now, kept with the invoice: later edits to the
  // customer never change what was issued (§B.1).
  const snapshot: CustomerSnapshot = {
    displayName: customer.displayName,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    addressLines: formatAddressLines(customer, market),
    taxId: customer.taxId,
  };
  const today = todayIn(settings.timezone, now);

  const outcome = await db.transaction(async (tx) => {
    const locked = await loadHeader(tx, actor, id, true);
    if (!locked || locked.status !== "DRAFT") return null;
    const number = locked.number ?? (await allocateDocumentNumber(tx, actor.organizationId, "invoice")).number;
    const status = issuedInvoiceStatus(
      { totalMinor: locked.totalMinor, paidMinor: locked.amountPaidMinor, dueDate: locked.dueDate },
      today,
    );
    await tx
      .update(invoices)
      .set({
        status,
        number,
        customerSnapshot: snapshot,
        paymentInstructions: profile.paymentInstructions,
        sentAt: sql`now()`,
      })
      .where(eq(invoices.id, locked.id));
    await revokeShareLinks(tx, invoiceDocument(actor, locked.id));
    const token = await createShareLink(tx, {
      ...invoiceDocument(actor, locked.id),
      expiresAt: invoiceLinkExpiresAt(locked.dueDate),
      createdBy: actor.userId,
    });
    const url = linkUrl(appUrl, token);
    await audit(tx, actor, "invoice.sent", locked.id, {
      number,
      totalMinor: locked.totalMinor,
      currency: locked.currency,
      status,
      channel: email ? "email" : "link",
    });
    if (email && emailTo) {
      await enqueueEmail(
        tx,
        documentLinkEmail({
          to: emailTo,
          businessName: profile.name,
          businessEmail: profile.email,
          title: market.documents.invoice.singular,
          number,
          total: formatMoney(locked.totalMinor, locked.currency, { locale: settings.locale }),
          dueLine: `Due ${formatCalendarDate(locked.dueDate, settings.locale)}`,
          message: email.message,
          url,
          action: `View the ${market.documents.invoice.singular.toLowerCase()}`,
        }),
        { organizationId: actor.organizationId },
      );
    }
    return { number, url };
  });

  if (!outcome) return { ok: false, error: ALREADY_SENT };
  return { ok: true, ...outcome };
}

/** Another link to an issued invoice (e.g. to paste into a chat), leaving earlier links open. */
export async function createInvoiceLink(
  actor: OrgActor,
  id: string,
  { appUrl }: { appUrl: string },
  db: Database = getDb(),
): Promise<InvoiceLinkResult> {
  assertCan(actor, "invoices.send");
  return db.transaction(async (tx): Promise<InvoiceLinkResult> => {
    const invoice = await loadHeader(tx, actor, id, true);
    if (!invoice) return { ok: false, notFound: true };
    if (invoice.status === "DRAFT") return { ok: false, error: "Send the invoice first; its link opens then." };
    if (invoice.status === "VOID" || invoice.status === "CANCELLED") {
      return { ok: false, error: "This invoice was voided or cancelled, so it has no link." };
    }
    const token = await createShareLink(tx, {
      ...invoiceDocument(actor, invoice.id),
      expiresAt: invoiceLinkExpiresAt(invoice.dueDate),
      createdBy: actor.userId,
    });
    await audit(tx, actor, "invoice.link_created", invoice.id, { number: invoice.number });
    return { ok: true, url: linkUrl(appUrl, token) };
  });
}

export type SharedInvoice = {
  invoice: Omit<InvoiceDetail, "customer">;
  business: DocumentLetterhead;
  countryCode: string;
  locale: string;
  organizationId: string;
};

/**
 * An invoice opened from its customer link. The link is the authorization: an
 * unknown, revoked or expired token (or a link to anything but an invoice)
 * finds nothing. Drafts are never shown.
 */
export async function getSharedInvoice(token: string, db: Database = getDb()): Promise<SharedInvoice | null> {
  const link = await resolveShareLink(db, token);
  if (!link || link.documentKind !== "invoice") return null;
  const [header] = await db
    .select(headerColumns)
    .from(invoices)
    .where(and(eq(invoices.id, link.documentId), eq(invoices.organizationId, link.organizationId)));
  if (!header || header.status === "DRAFT") return null;
  const [lines, business] = await Promise.all([
    loadLines(db, header.id),
    getLetterheadForSharedDocument(link.organizationId, db),
  ]);
  if (!business) return null;
  return {
    invoice: { ...header, lines },
    business,
    countryCode: business.countryCode,
    locale: business.locale,
    organizationId: link.organizationId,
  };
}

/**
 * Counts an open of a customer link; the first open is recorded on the
 * invoice (viewedAt) and audited. Invoices have no VIEWED status (§B.4). The
 * business opening its own link never calls this.
 */
export async function recordSharedInvoiceOpen(token: string, db: Database = getDb()): Promise<void> {
  await db.transaction(async (tx) => {
    const link = await resolveShareLink(tx, token);
    if (!link || link.documentKind !== "invoice") return;
    await recordShareLinkView(tx, token);
    const [first] = await tx
      .update(invoices)
      .set({ viewedAt: sql`now()` })
      .where(
        and(
          eq(invoices.id, link.documentId),
          eq(invoices.organizationId, link.organizationId),
          sql`${invoices.viewedAt} is null`,
          sql`${invoices.status} <> 'DRAFT'`,
        ),
      )
      .returning({ number: invoices.number });
    if (first) {
      await recordAuditEvent(tx, {
        action: "invoice.viewed",
        actorType: "customer",
        organizationId: link.organizationId,
        entityType: "invoice",
        entityId: link.documentId,
        metadata: { number: first.number },
      });
    }
  });
}
