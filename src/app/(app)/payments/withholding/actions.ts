"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { discardWithholdingScan, uploadWithholdingScan } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";
import { deleteVoidedCertificate, type RawCertificate, recordCertificate, updateCertificate, voidCertificate } from "@/modules/payments";

export type CertificateActionResponse =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; error: string };

const GONE = "This certificate no longer exists.";
const FAILED = "Couldn't save. Please try again.";

const rawLine = z.object({
  atcCode: z.string(),
  description: z.string(),
  rate: z.string(),
  month1: z.string(),
  month2: z.string(),
  month3: z.string(),
  taxWithheld: z.string(),
});
const rawCertificate = z.object({
  customerId: z.string(),
  payorTin: z.string(),
  payorName: z.string(),
  payorAddress: z.string(),
  year: z.string(),
  quarter: z.string(),
  receivedOn: z.string(),
  notes: z.string(),
  lines: z.array(rawLine).max(20),
  paymentIds: z.array(z.string()).max(500),
});

/** The certificate the form sent, or null when it isn't the shape the form sends. */
function readData(form: FormData): RawCertificate | null {
  const text = form.get("data");
  if (typeof text !== "string") return null;
  try {
    const parsed = rawCertificate.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function revalidate() {
  revalidatePath("/payments");
  revalidatePath("/payments/withholding");
  revalidatePath("/invoices");
}

/** Stores the scan the form sent, if any. Returns its id, or an error to show. */
async function storeScan(ctx: Awaited<ReturnType<typeof requireOrgContext>>, form: FormData) {
  const file = form.get("scan");
  if (!(file instanceof File) || file.size === 0) return { ok: true as const, fileId: null };
  const stored = await uploadWithholdingScan(ctx, { bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name });
  return stored.ok ? { ok: true as const, fileId: stored.fileId } : { ok: false as const, error: stored.error };
}

export async function recordCertificateAction(form: FormData): Promise<CertificateActionResponse> {
  const ctx = await requireOrgContext();
  const raw = readData(form);
  if (!raw) return { ok: false, error: FAILED };

  const scan = await storeScan(ctx, form);
  if (!scan.ok) return { ok: false, errors: { scan: scan.error } };

  const result = await recordCertificate(ctx, raw, { market: ctx.market, fileId: scan.fileId });
  if (!result.ok) {
    // The certificate was refused: don't leave its scan behind.
    if (scan.fileId) await discardWithholdingScan(ctx, scan.fileId);
    if ("errors" in result) return { ok: false, errors: result.errors };
    return { ok: false, error: "error" in result ? result.error : FAILED };
  }
  revalidate();
  return { ok: true, id: result.id };
}

export async function updateCertificateAction(id: string, form: FormData): Promise<CertificateActionResponse> {
  const ctx = await requireOrgContext();
  const raw = readData(form);
  if (!raw) return { ok: false, error: FAILED };

  const scan = await storeScan(ctx, form);
  if (!scan.ok) return { ok: false, errors: { scan: scan.error } };
  // A new file replaces the old one; "removeScan" clears it; otherwise the scan stays as it is.
  const fileId = scan.fileId ?? (form.get("removeScan") === "1" ? null : undefined);

  const result = await updateCertificate(ctx, id, raw, { market: ctx.market, fileId });
  if (!result.ok) {
    if (scan.fileId) await discardWithholdingScan(ctx, scan.fileId);
    if ("errors" in result) return { ok: false, errors: result.errors };
    return { ok: false, error: "error" in result ? result.error : GONE };
  }
  revalidate();
  return { ok: true, id: result.id };
}

export async function voidCertificateAction(
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await voidCertificate(ctx, id, reason);
  revalidate();
  if (result.ok) return { ok: true };
  if ("errors" in result) return { ok: false, errors: result.errors };
  return { ok: false, error: "error" in result ? result.error : GONE };
}

/** The owner: moves a void certificate to the recycle bin. */
export async function deleteCertificateAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const result = await deleteVoidedCertificate(ctx, id);
  revalidate();
  revalidatePath("/recycle-bin");
  if (result.ok) return { ok: true };
  return { ok: false, error: "error" in result ? result.error : GONE };
}
