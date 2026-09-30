import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { listTaxRates } from "@/modules/catalog";
import { findCustomerIds, getCustomer, getCustomerNames } from "@/modules/customers";
import {
  calculateDocument,
  type DocumentAmounts,
  type LineInput,
  numericToQuantity,
  type ParsedLine,
  quantityToNumeric,
  type TaxMode,
} from "@/modules/documents";
import { getDocumentSettings } from "@/modules/organizations";
import { addDays, type CalendarDate, todayIn } from "@/shared/dates/calendar";
import { escapeLikePattern } from "@/shared/text/search";
import { type QuoteDraft, parseQuoteDraft } from "../domain/quote-draft";
import type { QuoteStatus } from "../domain/status";
import { transitionQuote } from "../domain/transitions";
import { type CustomerSnapshot, quoteLines, quotes } from "../schema";

/** Quotes per page in the list. */
export const QUOTE_PAGE_SIZE = 25;

export type QuoteHeader = {
  id: string;
  number: string | null;
  revision: number;
  status: QuoteStatus;
  customerId: string | null;
  currency: string;
  taxMode: TaxMode;
  issueDate: CalendarDate;
  validUntil: CalendarDate;
  notes: string | null;
  terms: string | null;
  customerSnapshot: CustomerSnapshot | null;
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  sentAt: Date | null;
  cancelledAt: Date | null;
  updatedAt: Date;
};

export type QuoteLine = {
  position: number;
  description: string;
  unitLabel: string;
  /** Scaled ×10 000. */
  quantity: number;
  unitPriceMinor: number;
  discountKind: "percent" | "amount" | null;
  discountValue: number | null;
  taxRateId: string | null;
  taxRateName: string | null;
  taxRateBps: number | null;
  sourceKind: "product" | "service" | null;
  sourceId: string | null;
  grossMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type QuoteDetail = QuoteHeader & {
  /** The customer as they are now (drafts), for the editor's picker. */
  customer: { id: string; displayName: string; archived: boolean } | null;
  lines: QuoteLine[];
};

export type QuoteSummary = Pick<
  QuoteHeader,
  "id" | "number" | "revision" | "status" | "currency" | "totalMinor" | "issueDate" | "validUntil" | "updatedAt"
> & { customerName: string | null };

export type QuoteList = { quotes: QuoteSummary[]; page: number; hasMore: boolean; total: number };

export type NewQuoteDefaults = {
  currency: string;
  taxMode: TaxMode;
  issueDate: CalendarDate;
  validUntil: CalendarDate;
  notes: string;
  terms: string;
  defaultTaxRateId: string | null;
};

export type SaveQuoteDraftResult =
  | { ok: true; quote: QuoteHeader }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; notEditable: true; status: QuoteStatus };

export type QuoteCommandResult = { ok: true } | { ok: false; notFound: true } | { ok: false; error: string };

/** How typed input is read: the business's locale. */
export type QuoteInputOptions = { locale: string };

const headerColumns = {
  id: quotes.id,
  number: quotes.number,
  revision: quotes.revision,
  status: quotes.status,
  customerId: quotes.customerId,
  currency: quotes.currency,
  taxMode: quotes.taxMode,
  issueDate: quotes.issueDate,
  validUntil: quotes.validUntil,
  notes: quotes.notes,
  terms: quotes.terms,
  customerSnapshot: quotes.customerSnapshot,
  subtotalMinor: quotes.subtotalMinor,
  discountTotalMinor: quotes.discountTotalMinor,
  taxTotalMinor: quotes.taxTotalMinor,
  totalMinor: quotes.totalMinor,
  sentAt: quotes.sentAt,
  cancelledAt: quotes.cancelledAt,
  updatedAt: quotes.updatedAt,
};

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ofOrganization = (actor: OrgActor) => eq(quotes.organizationId, actor.organizationId);

function audit(tx: Executor, actor: OrgActor, action: AuditAction, quoteId: string, metadata?: Record<string, unknown>) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "quote",
    entityId: quoteId,
    metadata,
  });
}

/** Where a new quote starts: today in the business's time zone, its validity, terms and default tax. */
export async function newQuoteDefaults(
  actor: OrgActor,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<NewQuoteDefaults> {
  assertCan(actor, "quotes.write");
  const [settings, rates] = await Promise.all([getDocumentSettings(actor, db), listTaxRates(actor, db)]);
  const issueDate = todayIn(settings.timezone, now);
  return {
    currency: settings.currency,
    taxMode: settings.taxMode,
    issueDate,
    validUntil: addDays(issueDate, settings.quoteValidityDays),
    notes: settings.defaultNotes ?? "",
    terms: settings.defaultTerms ?? "",
    defaultTaxRateId: rates.find((r) => r.isDefault && r.archivedAt === null)?.id ?? null,
  };
}

async function loadHeader(tx: Executor, actor: OrgActor, id: string, lock = false) {
  if (!isUuid(id)) return undefined;
  const query = tx.select(headerColumns).from(quotes).where(and(eq(quotes.id, id), ofOrganization(actor)));
  const [row] = await (lock ? query.for("update") : query);
  return row;
}

async function loadLines(tx: Executor, quoteId: string): Promise<QuoteLine[]> {
  const rows = await tx
    .select({
      position: quoteLines.position,
      description: quoteLines.description,
      unitLabel: quoteLines.unitLabel,
      quantity: quoteLines.quantity,
      unitPriceMinor: quoteLines.unitPriceMinor,
      discountKind: quoteLines.discountKind,
      discountValue: quoteLines.discountValue,
      taxRateId: quoteLines.taxRateId,
      taxRateName: quoteLines.taxRateName,
      taxRateBps: quoteLines.taxRateBps,
      sourceKind: quoteLines.sourceKind,
      sourceId: quoteLines.sourceId,
      grossMinor: quoteLines.grossMinor,
      discountMinor: quoteLines.discountMinor,
      taxMinor: quoteLines.taxMinor,
      totalMinor: quoteLines.totalMinor,
    })
    .from(quoteLines)
    .where(eq(quoteLines.quoteId, quoteId))
    .orderBy(asc(quoteLines.position));
  return rows.map((row) => ({ ...row, quantity: numericToQuantity(row.quantity) }));
}

export async function getQuote(actor: OrgActor, id: string, db: Database = getDb()): Promise<QuoteDetail | null> {
  assertCan(actor, "quotes.read");
  const header = await loadHeader(db, actor, id);
  if (!header) return null;
  const [lines, customer] = await Promise.all([
    loadLines(db, header.id),
    header.customerId ? getCustomer(actor, header.customerId, db) : Promise.resolve(null),
  ]);
  return {
    ...header,
    lines,
    customer: customer
      ? { id: customer.id, displayName: customer.displayName, archived: customer.archivedAt !== null }
      : null,
  };
}

type ResolvedLine = ParsedLine & { tax: { id: string; name: string; rateBps: number } | null };

/**
 * Checks what the draft points at belongs to the business: its customer
 * (active, or the one already chosen) and each line's tax rate (active, or one
 * the draft already used). Returns the lines ready to calculate.
 */
async function resolveDraft(
  actor: OrgActor,
  draft: QuoteDraft,
  current: { customerId: string | null; taxRateIds: Set<string> },
  db: Database,
): Promise<{ ok: true; lines: ResolvedLine[] } | { ok: false; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};

  if (draft.customerId) {
    const customer = await getCustomer(actor, draft.customerId, db);
    const usable = customer && (customer.archivedAt === null || customer.id === current.customerId);
    if (!usable) errors.customerId = "Choose a customer from the list.";
  }

  const rates = await listTaxRates(actor, db);
  const byId = new Map(rates.map((rate) => [rate.id, rate]));
  const lines = draft.lines.map((line, index): ResolvedLine => {
    if (!line.taxRateId) return { ...line, tax: null };
    const rate = byId.get(line.taxRateId);
    if (!rate || (rate.archivedAt !== null && !current.taxRateIds.has(rate.id))) {
      errors[`lines.${index}.taxRateId`] = "Choose a tax rate from the list.";
      return { ...line, tax: null };
    }
    return { ...line, tax: { id: rate.id, name: rate.name, rateBps: rate.rateBps } };
  });

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, lines };
}

function calculate(
  taxMode: TaxMode,
  lines: readonly LineInput[],
): { ok: true; amounts: DocumentAmounts } | { ok: false; errors: Record<string, string> } {
  try {
    return { ok: true, amounts: calculateDocument({ taxMode, lines }) };
  } catch (error) {
    if (error instanceof RangeError) {
      return { ok: false, errors: { lines: "This quote is too large to total. Split it into smaller quotes." } };
    }
    throw error;
  }
}

/**
 * Autosaves a draft: creates it on the first save (`id` null), then replaces
 * its header and lines. Only drafts are edited in place; a sent quote is
 * revised first. Creation is audited; autosaves aren't (they fire as you type).
 */
export async function saveQuoteDraft(
  actor: OrgActor,
  id: string | null,
  input: unknown,
  { locale }: QuoteInputOptions,
  db: Database = getDb(),
): Promise<SaveQuoteDraftResult> {
  assertCan(actor, "quotes.write");
  const parsed = parseQuoteDraft(input, { locale });
  if (!parsed.ok) return parsed;
  const draft = parsed.draft;

  let current: { customerId: string | null; taxRateIds: Set<string>; taxMode: TaxMode } | null = null;
  if (id !== null) {
    const header = await loadHeader(db, actor, id);
    if (!header) return { ok: false, notFound: true };
    if (header.status !== "DRAFT") return { ok: false, notEditable: true, status: header.status };
    const lines = await loadLines(db, header.id);
    current = {
      customerId: header.customerId,
      taxRateIds: new Set(lines.flatMap((l) => (l.taxRateId ? [l.taxRateId] : []))),
      taxMode: header.taxMode,
    };
  }
  const taxMode = current?.taxMode ?? (await getDocumentSettings(actor, db)).taxMode;

  const resolved = await resolveDraft(actor, draft, current ?? { customerId: null, taxRateIds: new Set() }, db);
  if (!resolved.ok) return resolved;
  const calculated = calculate(taxMode, resolved.lines);
  if (!calculated.ok) return calculated;
  const { amounts } = calculated;

  const header = {
    customerId: draft.customerId,
    currency: draft.currency,
    issueDate: draft.issueDate,
    validUntil: draft.validUntil,
    notes: draft.notes,
    terms: draft.terms,
    subtotalMinor: amounts.subtotalMinor,
    discountTotalMinor: amounts.discountTotalMinor,
    taxTotalMinor: amounts.taxTotalMinor,
    totalMinor: amounts.totalMinor,
  };

  return db.transaction(async (tx): Promise<SaveQuoteDraftResult> => {
    let quote;
    if (id === null) {
      [quote] = await tx
        .insert(quotes)
        .values({ ...header, organizationId: actor.organizationId, taxMode, createdBy: actor.userId })
        .returning(headerColumns);
      if (!quote) throw new Error("Quote insert returned no row");
      await audit(tx, actor, "quote.created", quote.id);
    } else {
      // Re-check under the lock: it may have been sent from another tab.
      const locked = await loadHeader(tx, actor, id, true);
      if (!locked) return { ok: false, notFound: true };
      if (locked.status !== "DRAFT") return { ok: false, notEditable: true, status: locked.status };
      [quote] = await tx.update(quotes).set(header).where(eq(quotes.id, locked.id)).returning(headerColumns);
      if (!quote) throw new Error("Quote update returned no row");
      await tx.delete(quoteLines).where(eq(quoteLines.quoteId, quote.id));
    }

    if (resolved.lines.length > 0) {
      await tx.insert(quoteLines).values(
        resolved.lines.map((line, position) => {
          const a = amounts.lines[position]!;
          return {
            organizationId: actor.organizationId,
            quoteId: quote.id,
            position,
            sourceKind: line.source?.kind ?? null,
            sourceId: line.source?.id ?? null,
            description: line.description,
            unitLabel: line.unitLabel,
            quantity: quantityToNumeric(line.quantity),
            unitPriceMinor: line.unitPriceMinor,
            discountKind: line.discount?.kind ?? null,
            discountValue:
              line.discount === null ? null : line.discount.kind === "percent" ? line.discount.bps : line.discount.amountMinor,
            taxRateId: line.tax?.id ?? null,
            taxRateName: line.tax?.name ?? null,
            taxRateBps: line.tax?.rateBps ?? null,
            grossMinor: a.grossMinor,
            discountMinor: a.discountMinor,
            taxMinor: a.taxMinor,
            totalMinor: a.totalMinor,
          };
        }),
      );
    }
    return { ok: true, quote };
  });
}

/** Deletes a draft that was never sent (sent quotes keep their number and are cancelled instead). */
export async function deleteDraftQuote(actor: OrgActor, id: string, db: Database = getDb()): Promise<QuoteCommandResult> {
  assertCan(actor, "quotes.write");
  return db.transaction(async (tx): Promise<QuoteCommandResult> => {
    const quote = await loadHeader(tx, actor, id, true);
    if (!quote) return { ok: false, notFound: true };
    if (!transitionQuote(quote.status, "delete").ok || quote.number !== null) {
      return { ok: false, error: "Only drafts that were never sent can be deleted. Cancel this quote instead." };
    }
    await tx.delete(quotes).where(eq(quotes.id, quote.id));
    await audit(tx, actor, "quote.deleted", quote.id, { totalMinor: quote.totalMinor, currency: quote.currency });
    return { ok: true };
  });
}

/**
 * The business's quotes, most recently changed first, optionally filtered by
 * status or searched by number or customer. Sent quotes show the customer as
 * snapshotted; drafts show the customer as they are now.
 */
export async function listQuotes(
  actor: OrgActor,
  { search = null, status, page = 1 }: { search?: string | null; status?: QuoteStatus; page?: number },
  db: Database = getDb(),
): Promise<QuoteList> {
  assertCan(actor, "quotes.read");
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;

  let matches;
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    const customerIds = await findCustomerIds(actor, search, db);
    matches = or(
      ilike(quotes.number, pattern),
      sql`${quotes.customerSnapshot}->>'displayName' ilike ${pattern}`,
      customerIds.length > 0 ? inArray(quotes.customerId, customerIds) : undefined,
    );
  }
  const where = and(ofOrganization(actor), status ? eq(quotes.status, status) : undefined, matches);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: quotes.id,
        number: quotes.number,
        revision: quotes.revision,
        status: quotes.status,
        currency: quotes.currency,
        totalMinor: quotes.totalMinor,
        issueDate: quotes.issueDate,
        validUntil: quotes.validUntil,
        updatedAt: quotes.updatedAt,
        customerId: quotes.customerId,
        snapshotName: sql<string | null>`${quotes.customerSnapshot}->>'displayName'`,
      })
      .from(quotes)
      .where(where)
      .orderBy(desc(quotes.updatedAt), desc(quotes.id))
      .limit(QUOTE_PAGE_SIZE + 1)
      .offset((safePage - 1) * QUOTE_PAGE_SIZE),
    db.select({ value: count() }).from(quotes).where(ofOrganization(actor)),
  ]);

  const pageRows = rows.slice(0, QUOTE_PAGE_SIZE);
  const names = await getCustomerNames(
    actor,
    pageRows.flatMap((row) => (row.snapshotName === null && row.customerId ? [row.customerId] : [])),
    db,
  );
  return {
    quotes: pageRows.map(({ customerId, snapshotName, ...row }) => ({
      ...row,
      customerName: snapshotName ?? (customerId ? (names.get(customerId) ?? null) : null),
    })),
    page: safePage,
    hasMore: rows.length > QUOTE_PAGE_SIZE,
    total: total?.value ?? 0,
  };
}
