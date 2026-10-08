import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { resolveShareLink } from "@/modules/documents";
import { copyForPrint, type InvoiceCopy } from "../domain/printing";
import { invoices } from "../schema";

// Counting the PDFs of registered invoices, so every print after the first
// says "REPRINT" (RR 7-2024 Sec. 6 B.21, D19). The count moves in one
// statement, so two downloads at once can't both be the original. A print is
// recorded before the PDF is drawn: a PDF that then fails to render still
// counts, which only ever errs towards marking a copy as a reprint.

export type InvoicePrint = { copy: InvoiceCopy; printNumber: number };

type By = { actorType: "user"; actorId: string } | { actorType: "customer" };

async function countPrint(
  tx: Executor,
  invoice: { organizationId: string; id: string },
  by: By,
): Promise<InvoicePrint | null> {
  const [row] = await tx
    .update(invoices)
    .set({ printCount: sql`${invoices.printCount} + 1`, firstPrintedAt: sql`coalesce(${invoices.firstPrintedAt}, now())` })
    .where(
      and(
        eq(invoices.id, invoice.id),
        eq(invoices.organizationId, invoice.organizationId),
        isNotNull(invoices.registration),
        ne(invoices.status, "DRAFT"),
      ),
    )
    .returning({ printCount: invoices.printCount, number: invoices.number });
  if (!row) return null;
  const copy = copyForPrint(row.printCount);
  await recordAuditEvent(tx, {
    action: copy === "original" ? "invoice.printed" : "invoice.reprinted",
    actorType: by.actorType,
    actorId: by.actorType === "user" ? by.actorId : undefined,
    organizationId: invoice.organizationId,
    entityType: "invoice",
    entityId: invoice.id,
    metadata: { number: row.number, printNumber: row.printCount },
  });
  return { copy, printNumber: row.printCount };
}

/**
 * Records a PDF the business makes of one of its invoices. Null when the
 * invoice isn't an issued registered invoice (drafts, billing statements),
 * whose PDFs aren't counted.
 */
export async function recordInvoicePrint(actor: OrgActor, id: string, db: Database = getDb()): Promise<InvoicePrint | null> {
  assertCan(actor, "invoices.read");
  if (!z.uuid().safeParse(id).success) return null;
  return db.transaction((tx) =>
    countPrint(tx, { organizationId: actor.organizationId, id }, { actorType: "user", actorId: actor.userId }),
  );
}

/** Records a PDF the customer downloads from their link; the link is the authorization. */
export async function recordSharedInvoicePrint(token: string, db: Database = getDb()): Promise<InvoicePrint | null> {
  return db.transaction(async (tx) => {
    const link = await resolveShareLink(tx, token);
    if (!link || link.documentKind !== "invoice") return null;
    return countPrint(tx, { organizationId: link.organizationId, id: link.documentId }, { actorType: "customer" });
  });
}
