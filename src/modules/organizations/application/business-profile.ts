import { eq } from "drizzle-orm";
import { z } from "zod";
import { marketFor } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { type BusinessProfileInput, businessProfileSchemaFor } from "../domain/business-profile";
import { organizations } from "../schema";

export type BusinessProfile = BusinessProfileInput;

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
      .select({ ...profileColumns, countryCode: organizations.countryCode })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    if (!row) throw new Error("Organization not found");
    const { countryCode, ...current } = row;

    // Validated against the business's own market (e.g. its tax-ID format).
    const parsed = businessProfileSchemaFor(marketFor(countryCode)).safeParse(input);
    if (!parsed.success) {
      return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
    }
    const next = parsed.data;

    const changed = (Object.keys(next) as (keyof BusinessProfile)[]).filter(
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
