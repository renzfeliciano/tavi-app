"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/modules/identity";
import { restoreDeletedInvoice } from "@/modules/invoices";
import { restoreDeletedCertificate, restoreDeletedPayment } from "@/modules/payments";
import { restoreDeletedQuote, restoreDeletedSentQuote } from "@/modules/quotes";
import { discardTrashItem, emptyTrash, TRASH_KINDS, type TrashKind } from "@/modules/trash";

const GONE = "That item is no longer in the recycle bin. It may already have been restored or removed.";

export type TrashRestoreResult = { ok: true; href: string | null; note: string | null } | { ok: false; error: string };
export type TrashCommandResult = { ok: true } | { ok: false; error: string };

/** Brings a deleted record back; the toast links to it. */
export async function restoreTrashItemAction(kind: TrashKind, trashId: string): Promise<TrashRestoreResult> {
  const ctx = await requireOrgContext();
  if (!TRASH_KINDS.includes(kind)) return { ok: false, error: GONE };

  if (kind === "invoice") {
    const result = await restoreDeletedInvoice(ctx, trashId);
    if (!result.ok) return { ok: false, error: GONE };
    revalidatePath("/recycle-bin");
    revalidatePath("/invoices");
    revalidatePath("/quotes");
    const quote = ctx.market.documents.quote.singular.toLowerCase();
    const invoice = ctx.market.documents.invoice.singular.toLowerCase();
    return {
      ok: true,
      href: `/invoices/${result.invoiceId}`,
      note: result.detachedFromQuote
        ? `Its ${quote} became another ${invoice} in the meantime, so this one stands on its own.`
        : null,
    };
  }

  if (kind === "sent_quote") {
    const result = await restoreDeletedSentQuote(ctx, trashId);
    if (!result.ok) return { ok: false, error: GONE };
    revalidatePath("/recycle-bin");
    revalidatePath("/quotes");
    return {
      ok: true,
      href: `/quotes/${result.quoteId}`,
      note: `Its old link to the customer stays closed. Open a new link from the ${ctx.market.documents.quote.singular.toLowerCase()} if it's needed.`,
    };
  }

  if (kind === "payment") {
    const result = await restoreDeletedPayment(ctx, trashId);
    if (!result.ok) return { ok: false, error: GONE };
    revalidatePath("/recycle-bin");
    revalidatePath("/payments");
    return { ok: true, href: `/payments/${result.paymentId}`, note: "It's back as a void payment, so the balance is unchanged." };
  }

  if (kind === "certificate") {
    const result = await restoreDeletedCertificate(ctx, trashId);
    if (!result.ok) return { ok: false, error: GONE };
    revalidatePath("/recycle-bin");
    revalidatePath("/payments/withholding");
    return {
      ok: true,
      href: `/payments/withholding/${result.certificateId}`,
      note: "It's back as a void certificate, without its scan or payments.",
    };
  }

  const result = await restoreDeletedQuote(ctx, trashId);
  if (!result.ok) return { ok: false, error: GONE };
  revalidatePath("/recycle-bin");
  revalidatePath("/quotes");
  return { ok: true, href: `/quotes/${result.quoteId}`, note: null };
}

/** Owners and admins: removes one item for good. */
export async function discardTrashItemAction(trashId: string): Promise<TrashCommandResult> {
  const ctx = await requireOrgContext();
  const result = await discardTrashItem(ctx, trashId);
  revalidatePath("/recycle-bin");
  return result.ok ? { ok: true } : { ok: false, error: GONE };
}

/** Owners and admins: removes everything in the bin for good. */
export async function emptyTrashAction(): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await emptyTrash(ctx);
  revalidatePath("/recycle-bin");
  return result;
}
