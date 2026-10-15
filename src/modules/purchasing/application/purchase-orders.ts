import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { formatAddressLines, type MarketProfile } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { listTaxRates } from "@/modules/catalog";
import {
  allocateDocumentNumber,
  calculateDocument,
  type DocumentAmounts,
  type LineInput,
  numericToQuantity,
  type ParsedLine,
  quantityToNumeric,
  type TaxMode,
} from "@/modules/documents";
import {
  documentEmailLimitMessage,
  emailLimitReached,
  enqueueEmail,
  purchaseOrderEmail,
} from "@/modules/notifications";
import {
  getBusinessProfile,
  getDocumentSettings,
  type SellerSnapshot,
  sellerFrom,
} from "@/modules/organizations";
import {
  type CalendarDate,
  formatCalendarDate,
  todayIn,
} from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import {
  type PageMeta,
  pageMeta,
  pageWindow,
} from "@/shared/pagination/page-window";
import { escapeLikePattern } from "@/shared/text/search";
import { tooLong } from "@/shared/validation/messages";
import { PO_LIMITS } from "../domain/limits";
import {
  parsePurchaseOrderDraft,
  type PurchaseOrderDraft,
} from "../domain/purchase-order-draft";
import { parseReceipt, readinessToIssue } from "../domain/receiving";
import type { PurchaseOrderStatus } from "../domain/status";
import { transitionPurchaseOrder } from "../domain/transitions";
import {
  purchaseOrderLines,
  purchaseOrders,
  type SupplierSnapshot,
  suppliers,
} from "../schema";
import { getSupplier } from "./suppliers";

export type PurchaseOrderHeader = {
  id: string;
  number: string | null;
  status: PurchaseOrderStatus;
  supplierId: string | null;
  currency: string;
  taxMode: TaxMode;
  orderDate: CalendarDate;
  expectedDate: CalendarDate | null;
  notes: string | null;
  terms: string | null;
  supplierSnapshot: SupplierSnapshot | null;
  /** The business as it was when issued (D25); null on drafts. */
  sellerSnapshot: SellerSnapshot | null;
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  issuedAt: Date | null;
  receivedDate: CalendarDate | null;
  receiptNote: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  updatedAt: Date;
};

export type PurchaseOrderLine = {
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
  grossMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type PurchaseOrderDetail = PurchaseOrderHeader & {
  /** The supplier as they are now (drafts), for the form's picker. */
  supplier: {
    id: string;
    displayName: string;
    email: string | null;
    archived: boolean;
  } | null;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderSummary = Pick<
  PurchaseOrderHeader,
  | "id"
  | "number"
  | "status"
  | "currency"
  | "totalMinor"
  | "orderDate"
  | "expectedDate"
  | "receivedDate"
  | "updatedAt"
> & { supplierName: string | null };

/** `total` is every order the business has (it decides "nothing here yet"); the page meta describes what the search and status show. */
export type PurchaseOrderList = PageMeta & {
  orders: PurchaseOrderSummary[];
  total: number;
};

export type NewPurchaseOrderDefaults = {
  currency: string;
  taxMode: TaxMode;
  orderDate: CalendarDate;
  notes: string;
  terms: string;
  defaultTaxRateId: string | null;
};

export type SavePurchaseOrderResult =
  | { ok: true; order: PurchaseOrderHeader }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; notFound: true }
  | { ok: false; notEditable: true; status: PurchaseOrderStatus };

export type PurchaseOrderCommandResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export type IssuePurchaseOrderResult =
  | { ok: true; number: string }
  | { ok: false; notFound: true }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

export type PurchaseOrderInputOptions = {
  locale: string;
  units?: readonly string[] | null;
};

const headerColumns = {
  id: purchaseOrders.id,
  number: purchaseOrders.number,
  status: purchaseOrders.status,
  supplierId: purchaseOrders.supplierId,
  currency: purchaseOrders.currency,
  taxMode: purchaseOrders.taxMode,
  orderDate: purchaseOrders.orderDate,
  expectedDate: purchaseOrders.expectedDate,
  notes: purchaseOrders.notes,
  terms: purchaseOrders.terms,
  supplierSnapshot: purchaseOrders.supplierSnapshot,
  sellerSnapshot: purchaseOrders.sellerSnapshot,
  subtotalMinor: purchaseOrders.subtotalMinor,
  discountTotalMinor: purchaseOrders.discountTotalMinor,
  taxTotalMinor: purchaseOrders.taxTotalMinor,
  totalMinor: purchaseOrders.totalMinor,
  issuedAt: purchaseOrders.issuedAt,
  receivedDate: purchaseOrders.receivedDate,
  receiptNote: purchaseOrders.receiptNote,
  cancelledAt: purchaseOrders.cancelledAt,
  cancelReason: purchaseOrders.cancelReason,
  updatedAt: purchaseOrders.updatedAt,
};

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ofOrganization = (actor: Pick<OrgActor, "organizationId">) =>
  eq(purchaseOrders.organizationId, actor.organizationId);

function audit(
  tx: Executor,
  actor: OrgActor,
  action: AuditAction,
  orderId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "purchase_order",
    entityId: orderId,
    metadata,
  });
}

async function loadHeader(
  tx: Executor,
  actor: Pick<OrgActor, "organizationId">,
  id: string,
  lock = false,
) {
  if (!isUuid(id)) return undefined;
  const query = tx
    .select(headerColumns)
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), ofOrganization(actor)));
  const [row] = await (lock ? query.for("update") : query);
  return row;
}

async function loadLines(
  tx: Executor,
  orderId: string,
): Promise<PurchaseOrderLine[]> {
  const rows = await tx
    .select({
      position: purchaseOrderLines.position,
      description: purchaseOrderLines.description,
      unitLabel: purchaseOrderLines.unitLabel,
      quantity: purchaseOrderLines.quantity,
      unitPriceMinor: purchaseOrderLines.unitPriceMinor,
      discountKind: purchaseOrderLines.discountKind,
      discountValue: purchaseOrderLines.discountValue,
      taxRateId: purchaseOrderLines.taxRateId,
      taxRateName: purchaseOrderLines.taxRateName,
      taxRateBps: purchaseOrderLines.taxRateBps,
      grossMinor: purchaseOrderLines.grossMinor,
      discountMinor: purchaseOrderLines.discountMinor,
      taxMinor: purchaseOrderLines.taxMinor,
      totalMinor: purchaseOrderLines.totalMinor,
    })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, orderId))
    .orderBy(asc(purchaseOrderLines.position));
  return rows.map((row) => ({
    ...row,
    quantity: numericToQuantity(row.quantity),
  }));
}

export async function getPurchaseOrder(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<PurchaseOrderDetail | null> {
  assertCan(actor, "purchasing.read");
  const header = await loadHeader(db, actor, id);
  if (!header) return null;
  const [lines, supplier] = await Promise.all([
    loadLines(db, header.id),
    header.supplierId
      ? getSupplier(actor, header.supplierId, db)
      : Promise.resolve(null),
  ]);
  return {
    ...header,
    lines,
    supplier: supplier
      ? {
          id: supplier.id,
          displayName: supplier.displayName,
          email: supplier.email,
          archived: supplier.archivedAt !== null,
        }
      : null,
  };
}

/** Where a new order starts: today in the business's time zone, its currency, tax mode, terms and default tax. */
export async function newPurchaseOrderDefaults(
  actor: OrgActor,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<NewPurchaseOrderDefaults> {
  assertCan(actor, "purchasing.write");
  const [settings, rates] = await Promise.all([
    getDocumentSettings(actor, db),
    listTaxRates(actor, db),
  ]);
  return {
    currency: settings.currency,
    taxMode: settings.taxMode,
    orderDate: todayIn(settings.timezone, now),
    notes: settings.defaultNotes ?? "",
    terms: settings.defaultTerms ?? "",
    defaultTaxRateId:
      rates.find((r) => r.isDefault && r.archivedAt === null)?.id ?? null,
  };
}

type ResolvedLine = ParsedLine & {
  tax: { id: string; name: string; rateBps: number } | null;
};

/**
 * Checks what the draft points at belongs to the business: its supplier
 * (active, or the one already chosen) and each line's tax rate (active, or one
 * the draft already used). Returns the lines ready to calculate.
 */
async function resolveDraft(
  actor: OrgActor,
  draft: PurchaseOrderDraft,
  current: { supplierId: string | null; taxRateIds: Set<string> },
  db: Database,
): Promise<
  | { ok: true; lines: ResolvedLine[] }
  | { ok: false; errors: Record<string, string> }
> {
  const errors: Record<string, string> = {};

  if (draft.supplierId) {
    const supplier = await getSupplier(actor, draft.supplierId, db);
    const usable =
      supplier &&
      (supplier.archivedAt === null || supplier.id === current.supplierId);
    if (!usable) errors.supplierId = "Choose a supplier from the list.";
  }

  const rates = await listTaxRates(actor, db);
  const byId = new Map(rates.map((rate) => [rate.id, rate]));
  const lines = draft.lines.map((line, index): ResolvedLine => {
    if (!line.taxRateId) return { ...line, tax: null };
    const rate = byId.get(line.taxRateId);
    if (
      !rate ||
      (rate.archivedAt !== null && !current.taxRateIds.has(rate.id))
    ) {
      errors[`lines.${index}.taxRateId`] = "Choose a tax rate from the list.";
      return { ...line, tax: null };
    }
    return {
      ...line,
      tax: { id: rate.id, name: rate.name, rateBps: rate.rateBps },
    };
  });

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, lines };
}

function calculate(
  taxMode: TaxMode,
  lines: readonly LineInput[],
):
  | { ok: true; amounts: DocumentAmounts }
  | { ok: false; errors: Record<string, string> } {
  try {
    return { ok: true, amounts: calculateDocument({ taxMode, lines }) };
  } catch (error) {
    if (error instanceof RangeError) {
      return {
        ok: false,
        errors: {
          lines:
            "This purchase order is too large to total. Split it into smaller ones.",
        },
      };
    }
    throw error;
  }
}

/**
 * Saves a draft: creates it on the first save (`id` null), then replaces its
 * header and lines. Only drafts are edited; an issued order is cancelled and
 * made again. Creation is audited; later saves aren't.
 */
export async function savePurchaseOrderDraft(
  actor: OrgActor,
  id: string | null,
  input: unknown,
  { locale, units = null }: PurchaseOrderInputOptions,
  db: Database = getDb(),
): Promise<SavePurchaseOrderResult> {
  assertCan(actor, "purchasing.write");
  const parsed = parsePurchaseOrderDraft(input, { locale, units });
  if (!parsed.ok) return parsed;
  const draft = parsed.draft;

  let current: {
    supplierId: string | null;
    taxRateIds: Set<string>;
    taxMode: TaxMode;
  } | null = null;
  if (id !== null) {
    const header = await loadHeader(db, actor, id);
    if (!header) return { ok: false, notFound: true };
    if (header.status !== "DRAFT")
      return { ok: false, notEditable: true, status: header.status };
    const lines = await loadLines(db, header.id);
    current = {
      supplierId: header.supplierId,
      taxRateIds: new Set(
        lines.flatMap((l) => (l.taxRateId ? [l.taxRateId] : [])),
      ),
      taxMode: header.taxMode,
    };
  }
  const taxMode =
    current?.taxMode ?? (await getDocumentSettings(actor, db)).taxMode;

  const resolved = await resolveDraft(
    actor,
    draft,
    current ?? { supplierId: null, taxRateIds: new Set() },
    db,
  );
  if (!resolved.ok) return resolved;
  const calculated = calculate(taxMode, resolved.lines);
  if (!calculated.ok) return calculated;
  const { amounts } = calculated;

  const header = {
    supplierId: draft.supplierId,
    currency: draft.currency,
    orderDate: draft.orderDate,
    expectedDate: draft.expectedDate,
    notes: draft.notes,
    terms: draft.terms,
    subtotalMinor: amounts.subtotalMinor,
    discountTotalMinor: amounts.discountTotalMinor,
    taxTotalMinor: amounts.taxTotalMinor,
    totalMinor: amounts.totalMinor,
  };

  return db.transaction(async (tx): Promise<SavePurchaseOrderResult> => {
    let order;
    if (id === null) {
      [order] = await tx
        .insert(purchaseOrders)
        .values({
          ...header,
          organizationId: actor.organizationId,
          taxMode,
          createdBy: actor.userId,
        })
        .returning(headerColumns);
      if (!order) throw new Error("Purchase order insert returned no row");
      await audit(tx, actor, "purchase_order.created", order.id);
    } else {
      // Re-check under the lock: it may have been issued from another tab.
      const locked = await loadHeader(tx, actor, id, true);
      if (!locked) return { ok: false, notFound: true };
      if (locked.status !== "DRAFT")
        return { ok: false, notEditable: true, status: locked.status };
      [order] = await tx
        .update(purchaseOrders)
        .set(header)
        .where(eq(purchaseOrders.id, locked.id))
        .returning(headerColumns);
      if (!order) throw new Error("Purchase order update returned no row");
      await tx
        .delete(purchaseOrderLines)
        .where(eq(purchaseOrderLines.purchaseOrderId, order.id));
    }

    if (resolved.lines.length > 0) {
      await tx.insert(purchaseOrderLines).values(
        resolved.lines.map((line, position) => {
          const a = amounts.lines[position]!;
          return {
            organizationId: actor.organizationId,
            purchaseOrderId: order.id,
            position,
            description: line.description,
            unitLabel: line.unitLabel,
            quantity: quantityToNumeric(line.quantity),
            unitPriceMinor: line.unitPriceMinor,
            discountKind: line.discount?.kind ?? null,
            discountValue:
              line.discount === null
                ? null
                : line.discount.kind === "percent"
                  ? line.discount.bps
                  : line.discount.amountMinor,
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
    return { ok: true, order };
  });
}

/** Deletes a draft (it never had a number). Issued orders are cancelled instead. */
export async function deletePurchaseOrderDraft(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<PurchaseOrderCommandResult> {
  assertCan(actor, "purchasing.write");
  return db.transaction(async (tx): Promise<PurchaseOrderCommandResult> => {
    const order = await loadHeader(tx, actor, id, true);
    if (!order) return { ok: false, notFound: true };
    if (!transitionPurchaseOrder(order.status, "delete").ok) {
      return {
        ok: false,
        error: "Only drafts can be deleted. Cancel an issued order instead.",
      };
    }
    await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, order.id));
    await audit(tx, actor, "purchase_order.deleted", order.id, {
      totalMinor: order.totalMinor,
      currency: order.currency,
    });
    return { ok: true };
  });
}

export type PurchaseOrderEmailTarget = { to: string; message: string };
type EmailContext = { market: MarketProfile; appUrl?: string; now?: Date };
type EmailSender = { sender: { emailVerified: boolean } };

const parseEmail = (email: PurchaseOrderEmailTarget | null) => {
  if (!email) return { ok: true as const, to: null };
  const to = email.to.trim().toLowerCase();
  return z.email().safeParse(to).success
    ? { ok: true as const, to }
    : { ok: false as const };
};

async function queueOrderEmail(
  tx: Executor,
  actor: OrgActor,
  order: Pick<
    PurchaseOrderHeader,
    "number" | "orderDate" | "expectedDate" | "totalMinor" | "currency"
  > & {
    supplierName: string;
  },
  email: { to: string; message: string },
  { market, appUrl }: EmailContext,
  locale: string,
  profile: { name: string; email: string | null },
) {
  await enqueueEmail(
    tx,
    purchaseOrderEmail({
      to: email.to,
      businessName: profile.name,
      businessEmail: profile.email,
      title: market.documents.purchaseOrder.singular,
      number: order.number ?? "",
      supplierName: order.supplierName,
      total: formatMoney(order.totalMinor, order.currency, { locale }),
      orderedOn: formatCalendarDate(order.orderDate, locale),
      expectedOn: order.expectedDate
        ? formatCalendarDate(order.expectedDate, locale)
        : null,
      message: email.message,
      notice: market.supplementaryDocumentNotice,
      appUrl,
    }),
    { organizationId: actor.organizationId, actorUserId: actor.userId },
  );
}

const supplierSnapshotOf = (
  supplier: NonNullable<Awaited<ReturnType<typeof getSupplier>>>,
  market: MarketProfile,
): SupplierSnapshot => ({
  displayName: supplier.displayName,
  contactName: supplier.contactName,
  email: supplier.email,
  phone: supplier.phone,
  addressLines: formatAddressLines(supplier, market),
  taxId: supplier.taxId,
});

/**
 * Issues a draft: numbers it, keeps the supplier and the business as they are
 * now (D25) and, if asked, queues the email to the supplier. Everything is
 * checked before anything changes.
 */
export async function issuePurchaseOrder(
  actor: OrgActor,
  id: string,
  {
    sender,
    market,
    appUrl,
    email,
    now = new Date(),
  }: {
    sender: { emailVerified: boolean };
    email: PurchaseOrderEmailTarget | null;
    now?: Date;
  } & EmailContext,
  db: Database = getDb(),
): Promise<IssuePurchaseOrderResult> {
  assertCan(actor, "purchasing.issue");
  if (!sender.emailVerified) {
    return {
      ok: false,
      error:
        "Confirm your email address before issuing. We sent you a link when you signed up.",
    };
  }
  const target = parseEmail(email);
  if (!target.ok)
    return { ok: false, errors: { emailTo: "Enter a valid email address." } };

  const current = await loadHeader(db, actor, id);
  if (!current) return { ok: false, notFound: true };
  if (!transitionPurchaseOrder(current.status, "issue").ok) {
    return { ok: false, error: "This purchase order was already issued." };
  }
  // Checked before anything changes, so a refusal leaves the draft as it was.
  const limited = target.to ? await emailLimitReached(db, actor, now) : null;
  if (limited)
    return { ok: false, error: documentEmailLimitMessage(undefined, limited) };
  const [settings, profile] = await Promise.all([
    getDocumentSettings(actor, db),
    getBusinessProfile(actor, db),
  ]);
  const sellerSnapshot = sellerFrom(profile);

  const outcome = await db.transaction(
    async (
      tx,
    ): Promise<
      | { ok: true; number: string }
      | { ok: false; notFound: true }
      | { ok: false; errors: Record<string, string> }
      | { ok: false; error: string }
    > => {
      const locked = await loadHeader(tx, actor, id, true);
      if (!locked) return { ok: false, notFound: true };
      if (locked.status !== "DRAFT")
        return { ok: false, error: "This purchase order was already issued." };
      // What is frozen is what the draft holds now that nobody else can change it, not what it held when we began.
      const lines = await loadLines(tx, locked.id);
      const problems = readinessToIssue({
        supplierId: locked.supplierId,
        lineCount: lines.length,
      });
      if (Object.keys(problems).length > 0)
        return { ok: false, errors: problems };
      const supplier = locked.supplierId
        ? await getSupplier(actor, locked.supplierId, tx)
        : null;
      if (!supplier)
        return {
          ok: false,
          errors: { supplierId: "Choose a supplier before issuing." },
        };
      const supplierSnapshot = supplierSnapshotOf(supplier, market);

      const { number } = await allocateDocumentNumber(
        tx,
        actor.organizationId,
        "purchase_order",
      );
      await tx
        .update(purchaseOrders)
        .set({
          status: "ISSUED",
          number,
          supplierSnapshot,
          sellerSnapshot,
          issuedAt: sql`now()`,
        })
        .where(eq(purchaseOrders.id, locked.id));
      await audit(tx, actor, "purchase_order.issued", locked.id, {
        number,
        totalMinor: locked.totalMinor,
        currency: locked.currency,
        emailed: target.to !== null,
      });
      if (target.to && email) {
        await queueOrderEmail(
          tx,
          actor,
          { ...locked, number, supplierName: supplier.displayName },
          { to: target.to, message: email.message },
          { market, appUrl },
          settings.locale,
          profile,
        );
      }
      return { ok: true, number };
    },
  );

  return outcome;
}

/** Emails an issued or received order's details to a supplier (the PDF is downloaded separately). */
export async function emailPurchaseOrder(
  actor: OrgActor,
  id: string,
  email: PurchaseOrderEmailTarget,
  context: EmailContext & EmailSender,
  db: Database = getDb(),
): Promise<PurchaseOrderCommandResult> {
  assertCan(actor, "purchasing.issue");
  if (!context.sender.emailVerified) {
    return {
      ok: false,
      error:
        "Confirm your email address before sending. We sent you a link when you signed up.",
    };
  }
  const target = parseEmail(email);
  if (!target.ok || !target.to)
    return { ok: false, errors: { emailTo: "Enter a valid email address." } };
  const now = context.now ?? new Date();
  const [settings, profile] = await Promise.all([
    getDocumentSettings(actor, db),
    getBusinessProfile(actor, db),
  ]);
  const limited = await emailLimitReached(db, actor, now);
  if (limited)
    return {
      ok: false,
      error: documentEmailLimitMessage("Try again later", limited),
    };

  return db.transaction(async (tx): Promise<PurchaseOrderCommandResult> => {
    const order = await loadHeader(tx, actor, id, true);
    if (!order) return { ok: false, notFound: true };
    if (order.status === "DRAFT")
      return {
        ok: false,
        error: "Issue the purchase order before emailing it.",
      };
    if (order.status === "CANCELLED")
      return {
        ok: false,
        error: "This purchase order was cancelled, so it can't be emailed.",
      };
    await queueOrderEmail(
      tx,
      actor,
      { ...order, supplierName: order.supplierSnapshot?.displayName ?? "" },
      { to: target.to, message: email.message },
      context,
      settings.locale,
      profile,
    );
    await audit(tx, actor, "purchase_order.emailed", order.id, {
      number: order.number,
    });
    return { ok: true };
  });
}

/** The goods arrived: records when (whole order only). */
export async function receivePurchaseOrder(
  actor: OrgActor,
  id: string,
  input: unknown,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<PurchaseOrderCommandResult> {
  assertCan(actor, "purchasing.issue");
  const settings = await getDocumentSettings(actor, db);
  return db.transaction(async (tx): Promise<PurchaseOrderCommandResult> => {
    const order = await loadHeader(tx, actor, id, true);
    if (!order) return { ok: false, notFound: true };
    if (!transitionPurchaseOrder(order.status, "receive").ok) {
      return {
        ok: false,
        error: "Only an issued purchase order can be marked received.",
      };
    }
    const parsed = parseReceipt(input, {
      orderDate: order.orderDate,
      today: todayIn(settings.timezone, now),
    });
    if (!parsed.ok) return parsed;
    await tx
      .update(purchaseOrders)
      .set({
        status: "RECEIVED",
        receivedDate: parsed.receipt.receivedDate,
        receivedAt: sql`now()`,
        receiptNote: parsed.receipt.note,
      })
      .where(eq(purchaseOrders.id, order.id));
    await audit(tx, actor, "purchase_order.received", order.id, {
      number: order.number,
      receivedDate: parsed.receipt.receivedDate,
    });
    return { ok: true };
  });
}

/** Calls an issued order off. Its number stays used. */
export async function cancelPurchaseOrder(
  actor: OrgActor,
  id: string,
  reason: string,
  db: Database = getDb(),
): Promise<PurchaseOrderCommandResult> {
  assertCan(actor, "purchasing.issue");
  const note = reason.trim();
  return db.transaction(async (tx): Promise<PurchaseOrderCommandResult> => {
    const order = await loadHeader(tx, actor, id, true);
    if (!order) return { ok: false, notFound: true };
    if (!transitionPurchaseOrder(order.status, "cancel").ok) {
      return {
        ok: false,
        error: "Only an issued purchase order can be cancelled.",
      };
    }
    if (note === "")
      return { ok: false, error: "Say why you are cancelling it." };
    if (note.length > PO_LIMITS.cancelReason)
      return { ok: false, error: tooLong(PO_LIMITS.cancelReason) };
    await tx
      .update(purchaseOrders)
      .set({ status: "CANCELLED", cancelledAt: sql`now()`, cancelReason: note })
      .where(eq(purchaseOrders.id, order.id));
    await audit(tx, actor, "purchase_order.cancelled", order.id, {
      number: order.number,
      reason: note,
    });
    return { ok: true };
  });
}

export type ListPurchaseOrdersOptions = {
  search?: string | null;
  status?: PurchaseOrderStatus;
  page?: number;
  pageSize?: number;
};

/** The business's orders, newest first, optionally searched by number or supplier and narrowed to a status. */
export async function listPurchaseOrders(
  actor: OrgActor,
  { search = null, status, page = 1, pageSize }: ListPurchaseOrdersOptions,
  db: Database = getDb(),
): Promise<PurchaseOrderList> {
  assertCan(actor, "purchasing.read");
  const pattern = search ? `%${escapeLikePattern(search)}%` : null;
  const snapshotName = sql<string>`${purchaseOrders.supplierSnapshot}->>'displayName'`;
  const matches = pattern
    ? or(
        ilike(purchaseOrders.number, pattern),
        ilike(suppliers.displayName, pattern),
        ilike(snapshotName, pattern),
      )
    : undefined;
  const where = and(
    ofOrganization(actor),
    status ? eq(purchaseOrders.status, status) : undefined,
    matches,
  );
  const supplierJoin = and(
    eq(suppliers.organizationId, purchaseOrders.organizationId),
    eq(suppliers.id, purchaseOrders.supplierId),
  );

  const [[found], [all]] = await Promise.all([
    db
      .select({ value: count() })
      .from(purchaseOrders)
      .leftJoin(suppliers, supplierJoin)
      .where(where),
    db
      .select({ value: count() })
      .from(purchaseOrders)
      .where(ofOrganization(actor)),
  ]);
  const window = pageWindow({ page, pageSize, matching: found?.value ?? 0 });
  const rows = await db
    .select({
      id: purchaseOrders.id,
      number: purchaseOrders.number,
      status: purchaseOrders.status,
      currency: purchaseOrders.currency,
      totalMinor: purchaseOrders.totalMinor,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      receivedDate: purchaseOrders.receivedDate,
      updatedAt: purchaseOrders.updatedAt,
      snapshotName,
      liveName: suppliers.displayName,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, supplierJoin)
    .where(where)
    .orderBy(
      desc(purchaseOrders.orderDate),
      desc(purchaseOrders.createdAt),
      desc(purchaseOrders.id),
    )
    .limit(window.pageSize)
    .offset(window.offset);

  return {
    orders: rows.map(({ snapshotName: snapshot, liveName, ...row }) => ({
      ...row,
      supplierName: snapshot ?? liveName ?? null,
    })),
    total: all?.value ?? 0,
    ...pageMeta(window),
  };
}
