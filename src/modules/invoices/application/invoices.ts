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
import { clearQuoteConversion, type CustomerSnapshot } from "@/modules/quotes";
import { addDays, type CalendarDate, todayIn } from "@/shared/dates/calendar";
import { escapeLikePattern } from "@/shared/text/search";
import { type InvoiceDraft, parseInvoiceDraft } from "../domain/invoice-draft";
import {
  type QualifiedDiscountConfig,
  qualifiedDiscountInput,
  type QualifiedDiscountSnapshot,
} from "../domain/qualified-discount";
import type { InvoiceStatus } from "../domain/status";
import { transitionInvoice } from "../domain/transitions";
import { invoiceLines, invoices } from "../schema";
import type { InvoiceRegistrationSnapshot } from "../domain/registration";

// Invoice drafts (§B.4): created blank or from an approved quote, autosaved
// like quotes, deleted only while never issued.

/** Invoices per page in the list. */
export const INVOICE_PAGE_SIZE = 25;

export type InvoiceHeader = {
  id: string;
  number: string | null;
  revision: number;
  status: InvoiceStatus;
  customerId: string | null;
  sourceQuoteId: string | null;
  currency: string;
  taxMode: TaxMode;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  notes: string | null;
  terms: string | null;
  customerSnapshot: CustomerSnapshot | null;
  paymentInstructions: string | null;
  /** Set on registered invoices (invoice mode, 1.12); null on billing statements. */
  registration: InvoiceRegistrationSnapshot | null;
  /** PDFs made of it as a registered invoice (D19); after the first, each says "REPRINT". */
  printCount: number;
  /** A qualified buyer's discount on the whole bill (D19), or null. */
  qualifiedDiscount: QualifiedDiscountSnapshot | null;
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  qualifiedDiscountMinor: number;
  taxWaivedMinor: number;
  amountPaidMinor: number;
  sentAt: Date | null;
  viewedAt: Date | null;
  editedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  updatedAt: Date;
};

export type InvoiceLine = {
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
  qualifiedDiscountMinor: number;
  taxWaivedMinor: number;
};

export type InvoiceDetail = InvoiceHeader & {
  /** The customer as they are now (drafts), for the editor's picker. */
  customer: { id: string; displayName: string; archived: boolean } | null;
  lines: InvoiceLine[];
};

export type InvoiceSummary = Pick<
  InvoiceHeader,
  "id" | "number" | "revision" | "status" | "currency" | "totalMinor" | "amountPaidMinor" | "issueDate" | "dueDate" | "updatedAt"
> & { customerName: string | null };

export type InvoiceList = { invoices: InvoiceSummary[]; page: number; hasMore: boolean; total: number };

export type NewInvoiceDefaults = {
  currency: string;
  taxMode: TaxMode;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  notes: string;
  terms: string;
  defaultTaxRateId: string | null;
};

export type SaveInvoiceDraftResult =
  | { ok: true; invoice: InvoiceHeader }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; notEditable: true; status: InvoiceStatus };

export type InvoiceCommandResult = { ok: true } | { ok: false; notFound: true } | { ok: false; error: string };

/** Module-internal (used by the other invoice use cases); not exported from the module. */
export const headerColumns = {
  id: invoices.id,
  number: invoices.number,
  revision: invoices.revision,
  status: invoices.status,
  customerId: invoices.customerId,
  sourceQuoteId: invoices.sourceQuoteId,
  currency: invoices.currency,
  taxMode: invoices.taxMode,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  notes: invoices.notes,
  terms: invoices.terms,
  customerSnapshot: invoices.customerSnapshot,
  paymentInstructions: invoices.paymentInstructions,
  registration: invoices.registration,
  printCount: invoices.printCount,
  qualifiedDiscount: invoices.qualifiedDiscount,
  subtotalMinor: invoices.subtotalMinor,
  discountTotalMinor: invoices.discountTotalMinor,
  taxTotalMinor: invoices.taxTotalMinor,
  totalMinor: invoices.totalMinor,
  qualifiedDiscountMinor: invoices.qualifiedDiscountMinor,
  taxWaivedMinor: invoices.taxWaivedMinor,
  amountPaidMinor: invoices.amountPaidMinor,
  sentAt: invoices.sentAt,
  viewedAt: invoices.viewedAt,
  editedAt: invoices.editedAt,
  voidedAt: invoices.voidedAt,
  voidReason: invoices.voidReason,
  cancelledAt: invoices.cancelledAt,
  cancelReason: invoices.cancelReason,
  updatedAt: invoices.updatedAt,
};

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ofOrganization = (actor: Pick<OrgActor, "organizationId">) => eq(invoices.organizationId, actor.organizationId);

export function audit(
  tx: Executor,
  actor: OrgActor,
  action: AuditAction,
  invoiceId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "invoice",
    entityId: invoiceId,
    metadata,
  });
}

/** Where a new invoice starts: today in the business's time zone, its payment terms, notes and default tax. */
export async function newInvoiceDefaults(
  actor: OrgActor,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<NewInvoiceDefaults> {
  assertCan(actor, "invoices.write");
  const [settings, rates] = await Promise.all([getDocumentSettings(actor, db), listTaxRates(actor, db)]);
  const issueDate = todayIn(settings.timezone, now);
  return {
    currency: settings.currency,
    taxMode: settings.taxMode,
    issueDate,
    dueDate: addDays(issueDate, settings.paymentTermsDays),
    notes: settings.defaultNotes ?? "",
    terms: settings.defaultTerms ?? "",
    defaultTaxRateId: rates.find((r) => r.isDefault && r.archivedAt === null)?.id ?? null,
  };
}

export async function loadHeader(tx: Executor, actor: Pick<OrgActor, "organizationId">, id: string, lock = false) {
  if (!isUuid(id)) return undefined;
  const query = tx.select(headerColumns).from(invoices).where(and(eq(invoices.id, id), ofOrganization(actor)));
  const [row] = await (lock ? query.for("update") : query);
  return row;
}

export async function loadLines(tx: Executor, invoiceId: string): Promise<InvoiceLine[]> {
  const rows = await tx
    .select({
      position: invoiceLines.position,
      description: invoiceLines.description,
      unitLabel: invoiceLines.unitLabel,
      quantity: invoiceLines.quantity,
      unitPriceMinor: invoiceLines.unitPriceMinor,
      discountKind: invoiceLines.discountKind,
      discountValue: invoiceLines.discountValue,
      taxRateId: invoiceLines.taxRateId,
      taxRateName: invoiceLines.taxRateName,
      taxRateBps: invoiceLines.taxRateBps,
      sourceKind: invoiceLines.sourceKind,
      sourceId: invoiceLines.sourceId,
      grossMinor: invoiceLines.grossMinor,
      discountMinor: invoiceLines.discountMinor,
      taxMinor: invoiceLines.taxMinor,
      totalMinor: invoiceLines.totalMinor,
      qualifiedDiscountMinor: invoiceLines.qualifiedDiscountMinor,
      taxWaivedMinor: invoiceLines.taxWaivedMinor,
    })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(asc(invoiceLines.position));
  return rows.map((row) => ({ ...row, quantity: numericToQuantity(row.quantity) }));
}

/** Stored lines as rows for another invoice (conversion, duplicate): the same snapshot and amounts. */
export function copyLines(
  lines: readonly (Omit<InvoiceLine, "position" | "qualifiedDiscountMinor" | "taxWaivedMinor"> &
    Partial<Pick<InvoiceLine, "qualifiedDiscountMinor" | "taxWaivedMinor">>)[],
  target: { organizationId: string; invoiceId: string },
) {
  return lines.map((line, position) => ({
    ...line,
    ...target,
    position,
    quantity: quantityToNumeric(line.quantity),
  }));
}

export async function getInvoice(actor: OrgActor, id: string, db: Database = getDb()): Promise<InvoiceDetail | null> {
  assertCan(actor, "invoices.read");
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
export async function resolveDraft(
  actor: OrgActor,
  draft: InvoiceDraft,
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

export function calculate(
  taxMode: TaxMode,
  lines: readonly LineInput[],
  qualifiedDiscount: QualifiedDiscountSnapshot | null = null,
): { ok: true; amounts: DocumentAmounts } | { ok: false; errors: Record<string, string> } {
  try {
    return { ok: true, amounts: calculateDocument({ taxMode, lines, qualifiedDiscount: qualifiedDiscountInput(qualifiedDiscount) }) };
  } catch (error) {
    if (error instanceof RangeError) {
      return { ok: false, errors: { lines: "This invoice is too large to total. Split it into smaller invoices." } };
    }
    throw error;
  }
}

/** A draft's totals and qualified discount as stored on the invoice. */
export function headerAmounts(amounts: DocumentAmounts, qualifiedDiscount: QualifiedDiscountSnapshot | null) {
  return {
    qualifiedDiscount,
    subtotalMinor: amounts.subtotalMinor,
    discountTotalMinor: amounts.discountTotalMinor,
    taxTotalMinor: amounts.taxTotalMinor,
    totalMinor: amounts.totalMinor,
    qualifiedDiscountMinor: amounts.qualifiedDiscountTotalMinor,
    taxWaivedMinor: amounts.taxWaivedTotalMinor,
  };
}

/** Resolved draft lines as rows, each with its snapshot and computed amounts. */
export function lineRows(
  target: { organizationId: string; invoiceId: string },
  lines: readonly ResolvedLine[],
  amounts: DocumentAmounts,
) {
  return lines.map((line, position) => {
    const a = amounts.lines[position]!;
    return {
      ...target,
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
      qualifiedDiscountMinor: a.qualifiedDiscountMinor,
      taxWaivedMinor: a.taxWaivedMinor,
    };
  });
}

/**
 * Autosaves a draft: creates it on the first save (`id` null), then replaces
 * its header and lines. Only drafts are edited here. Creation is audited;
 * autosaves aren't (they fire as you type).
 */
export async function saveInvoiceDraft(
  actor: OrgActor,
  id: string | null,
  input: unknown,
  { locale, qualifiedDiscounts = null }: { locale: string; qualifiedDiscounts?: QualifiedDiscountConfig | null },
  db: Database = getDb(),
): Promise<SaveInvoiceDraftResult> {
  assertCan(actor, "invoices.write");
  const parsed = parseInvoiceDraft(input, { locale, qualifiedDiscounts });
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
  const calculated = calculate(taxMode, resolved.lines, draft.qualifiedDiscount);
  if (!calculated.ok) return calculated;
  const { amounts } = calculated;

  const header = {
    customerId: draft.customerId,
    currency: draft.currency,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    notes: draft.notes,
    terms: draft.terms,
    ...headerAmounts(amounts, draft.qualifiedDiscount),
  };

  return db.transaction(async (tx): Promise<SaveInvoiceDraftResult> => {
    let invoice;
    if (id === null) {
      [invoice] = await tx
        .insert(invoices)
        .values({ ...header, organizationId: actor.organizationId, taxMode, createdBy: actor.userId })
        .returning(headerColumns);
      if (!invoice) throw new Error("Invoice insert returned no row");
      await audit(tx, actor, "invoice.created", invoice.id);
    } else {
      // Re-check under the lock: it may have been issued from another tab.
      const locked = await loadHeader(tx, actor, id, true);
      if (!locked) return { ok: false, notFound: true };
      if (locked.status !== "DRAFT") return { ok: false, notEditable: true, status: locked.status };
      [invoice] = await tx.update(invoices).set(header).where(eq(invoices.id, locked.id)).returning(headerColumns);
      if (!invoice) throw new Error("Invoice update returned no row");
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id));
    }

    if (resolved.lines.length > 0) {
      await tx
        .insert(invoiceLines)
        .values(lineRows({ organizationId: actor.organizationId, invoiceId: invoice.id }, resolved.lines, amounts));
    }
    return { ok: true, invoice };
  });
}

/**
 * Deletes a draft that was never issued (issued invoices keep their number
 * and are voided or cancelled instead). A draft converted from a quote frees
 * that quote to be converted again.
 */
export async function deleteDraftInvoice(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<InvoiceCommandResult & { sourceQuoteId?: string | null }> {
  assertCan(actor, "invoices.write");
  return db.transaction(async (tx) => {
    const invoice = await loadHeader(tx, actor, id, true);
    if (!invoice) return { ok: false as const, notFound: true as const };
    if (!transitionInvoice(invoice.status, "delete").ok || invoice.number !== null) {
      return { ok: false as const, error: "Only drafts that were never sent can be deleted. Void or cancel this invoice instead." };
    }
    await tx.delete(invoices).where(eq(invoices.id, invoice.id));
    if (invoice.sourceQuoteId) await clearQuoteConversion(tx, actor, invoice.sourceQuoteId, invoice.id);
    await audit(tx, actor, "invoice.deleted", invoice.id, {
      totalMinor: invoice.totalMinor,
      currency: invoice.currency,
      sourceQuoteId: invoice.sourceQuoteId,
    });
    return { ok: true as const, sourceQuoteId: invoice.sourceQuoteId };
  });
}

/**
 * The business's invoices, most recently changed first, optionally filtered
 * by status or searched by number or customer. Issued invoices show the
 * customer as snapshotted; drafts show the customer as they are now.
 */
export async function listInvoices(
  actor: OrgActor,
  { search = null, status, page = 1 }: { search?: string | null; status?: InvoiceStatus; page?: number },
  db: Database = getDb(),
): Promise<InvoiceList> {
  assertCan(actor, "invoices.read");
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;

  let matches;
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    const customerIds = await findCustomerIds(actor, search, db);
    matches = or(
      ilike(invoices.number, pattern),
      sql`${invoices.customerSnapshot}->>'displayName' ilike ${pattern}`,
      customerIds.length > 0 ? inArray(invoices.customerId, customerIds) : undefined,
    );
  }
  const where = and(ofOrganization(actor), status ? eq(invoices.status, status) : undefined, matches);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        revision: invoices.revision,
        status: invoices.status,
        currency: invoices.currency,
        totalMinor: invoices.totalMinor,
        amountPaidMinor: invoices.amountPaidMinor,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        updatedAt: invoices.updatedAt,
        customerId: invoices.customerId,
        snapshotName: sql<string | null>`${invoices.customerSnapshot}->>'displayName'`,
      })
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.updatedAt), desc(invoices.id))
      .limit(INVOICE_PAGE_SIZE + 1)
      .offset((safePage - 1) * INVOICE_PAGE_SIZE),
    db.select({ value: count() }).from(invoices).where(ofOrganization(actor)),
  ]);

  const pageRows = rows.slice(0, INVOICE_PAGE_SIZE);
  const names = await getCustomerNames(
    actor,
    pageRows.flatMap((row) => (row.snapshotName === null && row.customerId ? [row.customerId] : [])),
    db,
  );
  return {
    invoices: pageRows.map(({ customerId, snapshotName, ...row }) => ({
      ...row,
      customerName: snapshotName ?? (customerId ? (names.get(customerId) ?? null) : null),
    })),
    page: safePage,
    hasMore: rows.length > INVOICE_PAGE_SIZE,
    total: total?.value ?? 0,
  };
}
