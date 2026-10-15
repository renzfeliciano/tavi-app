import { asc, eq, getTableColumns } from "drizzle-orm";
import type { Executor } from "@/db";
import { payments, receipts, withholdingCertificateLines, withholdingCertificatePayments, withholdingCertificates } from "../schema";

/** Every payment of a business, voided ones too, for "Download your data". */
export async function exportPayments(executor: Executor, organizationId: string) {
  return executor
    .select()
    .from(payments)
    .where(eq(payments.organizationId, organizationId))
    .orderBy(asc(payments.createdAt), asc(payments.id));
}

/**
 * Every receipt a business issued for money that is not an invoice payment, void ones too, for "Download your data".
 * The idempotency key is a technical detail and is left out.
 */
export async function exportReceipts(executor: Executor, organizationId: string) {
  const columns: Partial<ReturnType<typeof getTableColumns<typeof receipts>>> = getTableColumns(receipts);
  delete columns.idempotencyKey;
  return executor
    .select(columns as Omit<ReturnType<typeof getTableColumns<typeof receipts>>, "idempotencyKey">)
    .from(receipts)
    .where(eq(receipts.organizationId, organizationId))
    .orderBy(asc(receipts.createdAt), asc(receipts.id));
}

/**
 * Every withholding certificate (PH: BIR Form 2307) of a business, void ones too, each with its rows and the ids of
 * the payments it covers, for "Download your data". The scan itself is a file and is not part of the download.
 */
export async function exportWithholdingCertificates(executor: Executor, organizationId: string) {
  const certificates = await executor
    .select()
    .from(withholdingCertificates)
    .where(eq(withholdingCertificates.organizationId, organizationId))
    .orderBy(asc(withholdingCertificates.createdAt), asc(withholdingCertificates.id));
  const lines = await executor
    .select()
    .from(withholdingCertificateLines)
    .where(eq(withholdingCertificateLines.organizationId, organizationId))
    .orderBy(asc(withholdingCertificateLines.certificateId), asc(withholdingCertificateLines.position));
  const links = await executor
    .select({ certificateId: withholdingCertificatePayments.certificateId, paymentId: withholdingCertificatePayments.paymentId })
    .from(withholdingCertificatePayments)
    .where(eq(withholdingCertificatePayments.organizationId, organizationId))
    .orderBy(asc(withholdingCertificatePayments.paymentId));

  return certificates.map((certificate) => ({
    ...certificate,
    lines: lines.filter((line) => line.certificateId === certificate.id),
    paymentIds: links.filter((link) => link.certificateId === certificate.id).map((link) => link.paymentId),
  }));
}
