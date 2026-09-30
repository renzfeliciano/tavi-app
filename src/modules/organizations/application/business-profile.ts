import { eq } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { type BusinessProfileInput, businessProfileSchema } from "../domain/business-profile";
import { organizations } from "../schema";

export type BusinessProfile = BusinessProfileInput;

export type UpdateBusinessProfileResult =
  | { ok: true }
  | { ok: false; fieldErrors: Partial<Record<keyof BusinessProfileInput, string[]>> };

const profileColumns = {
  name: organizations.name,
  legalName: organizations.legalName,
  taxId: organizations.taxId,
  email: organizations.email,
  phone: organizations.phone,
  addressLine1: organizations.addressLine1,
  addressLine2: organizations.addressLine2,
  city: organizations.city,
  province: organizations.province,
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
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const next = parsed.data;

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select(profileColumns)
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    if (!current) throw new Error("Organization not found");

    const changed = (Object.keys(next) as (keyof BusinessProfile)[]).filter(
      (key) => next[key] !== current[key],
    );
    if (changed.length === 0) return;

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
  });

  return { ok: true };
}
