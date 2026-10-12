import { eq } from "drizzle-orm";
import { z } from "zod";
import { marketFor } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { type BusinessProfileInput, businessProfileSchemaFor } from "../domain/business-profile";
import { incomeTaxConflict } from "../domain/registration";
import { type PaymentQr, parsePaymentQrs, type RawPaymentQr } from "../domain/payment-qr";
import { organizations } from "../schema";

/** The business as printed on documents: the profile form's fields, plus its payment QR codes (saved on their own). */
export type BusinessProfile = BusinessProfileInput & { paymentQrs: PaymentQr[] };

export type UpdateBusinessProfileResult =
  | { ok: true }
  | { ok: false; fieldErrors: Partial<Record<keyof BusinessProfileInput, string[]>> };

const profileColumns = {
  name: organizations.name,
  legalName: organizations.legalName,
  taxId: organizations.taxId,
  taxRegistration: organizations.taxRegistration,
  email: organizations.email,
  phone: organizations.phone,
  addressLine1: organizations.addressLine1,
  addressLine2: organizations.addressLine2,
  city: organizations.city,
  region: organizations.region,
  postalCode: organizations.postalCode,
  currency: organizations.defaultCurrency,
  taxMode: organizations.taxMode,
  quoteValidityDays: organizations.quoteValidityDays,
  paymentTermsDays: organizations.paymentTermsDays,
  defaultNotes: organizations.defaultNotes,
  defaultTerms: organizations.defaultTerms,
  paymentInstructions: organizations.paymentInstructions,
  paymentQrs: organizations.paymentQrs,
};

/** The business details and document defaults of the actor's organization. */
export async function getBusinessProfile(
  actor: OrgActor,
  db: Database = getDb(),
): Promise<BusinessProfile> {
  const [row] = await db
    .select(profileColumns)
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId));
  if (!row) throw new Error("Organization not found");
  return row;
}

export type DocumentLetterhead = BusinessProfile & { countryCode: string; locale: string; timezone: string };

/**
 * A business's letterhead for a document opened from a customer link. There
 * is no signed-in user here: callers must first resolve a valid share link,
 * which is what authorizes reading this one organization.
 */
export async function getLetterheadForSharedDocument(
  organizationId: string,
  db: Database = getDb(),
): Promise<DocumentLetterhead | null> {
  const [row] = await db
    .select({
      ...profileColumns,
      countryCode: organizations.countryCode,
      locale: organizations.locale,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  return row ?? null;
}

export type DocumentSettings = {
  currency: string;
  taxMode: "inclusive" | "exclusive";
  timezone: string;
  locale: string;
  quoteValidityDays: number;
  paymentTermsDays: number;
  defaultNotes: string | null;
  defaultTerms: string | null;
};

/** What new quotes and invoices start from: the business's defaults, time zone and locale. */
export async function getDocumentSettings(actor: OrgActor, db: Database = getDb()): Promise<DocumentSettings> {
  const [row] = await db
    .select({
      currency: organizations.defaultCurrency,
      taxMode: organizations.taxMode,
      timezone: organizations.timezone,
      locale: organizations.locale,
      quoteValidityDays: organizations.quoteValidityDays,
      paymentTermsDays: organizations.paymentTermsDays,
      defaultNotes: organizations.defaultNotes,
      defaultTerms: organizations.defaultTerms,
    })
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId));
  if (!row) throw new Error("Organization not found");
  return row;
}

/**
 * Saves the business profile. Only fields that actually changed are written
 * and audited (by name, not value: the log shouldn't copy contact details).
 */
export async function updateBusinessProfile(
  actor: OrgActor,
  input: unknown,
  db: Database = getDb(),
): Promise<UpdateBusinessProfileResult> {
  assertCan(actor, "organization.manage");

  return db.transaction(async (tx): Promise<UpdateBusinessProfileResult> => {
    const [row] = await tx
      .select({ ...profileColumns, countryCode: organizations.countryCode, incomeTaxOption: organizations.incomeTaxOption })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    if (!row) throw new Error("Organization not found");
    const { countryCode, incomeTaxOption, ...current } = row;

    // Validated against the business's own market (e.g. its tax-ID format).
    const market = marketFor(countryCode);
    const parsed = businessProfileSchemaFor(market).safeParse(input);
    if (!parsed.success) {
      return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
    }
    const next = parsed.data;

    // The 8% option and VAT or percentage tax exclude each other (registration details).
    const conflict = market.registration ? incomeTaxConflict(market.registration, incomeTaxOption, next.taxRegistration) : null;
    if (conflict) return { ok: false, fieldErrors: { taxRegistration: [conflict] } };

    const changed = (Object.keys(next) as (keyof BusinessProfileInput)[]).filter(
      (key) => next[key] !== current[key],
    );
    if (changed.length === 0) return { ok: true };

    const { currency, ...rest } = next;
    await tx
      .update(organizations)
      .set({ ...rest, defaultCurrency: currency })
      .where(eq(organizations.id, actor.organizationId));
    await recordAuditEvent(tx, {
      action: "organization.updated",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { changed },
    });
    return { ok: true };
  });
}

export type UpdatePaymentQrsResult = { ok: true } | { ok: false; errors: Record<string, string> };

/**
 * Saves the business's payment QR codes (what a customer scans to pay). They
 * are separate from the profile form: a row is a label and the text inside the
 * QR. The audit log records that they changed, never what they hold.
 */
export async function updatePaymentQrs(
  actor: OrgActor,
  rows: RawPaymentQr[],
  db: Database = getDb(),
): Promise<UpdatePaymentQrsResult> {
  assertCan(actor, "organization.manage");
  const parsed = parsePaymentQrs(rows);
  if (!parsed.ok) return parsed;

  return db.transaction(async (tx): Promise<UpdatePaymentQrsResult> => {
    const [row] = await tx
      .select({ paymentQrs: organizations.paymentQrs })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    if (!row) throw new Error("Organization not found");
    if (JSON.stringify(row.paymentQrs) === JSON.stringify(parsed.qrs)) return { ok: true };

    await tx.update(organizations).set({ paymentQrs: parsed.qrs }).where(eq(organizations.id, actor.organizationId));
    await recordAuditEvent(tx, {
      action: "organization.updated",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { changed: ["paymentQrs"] },
    });
    return { ok: true };
  });
}
