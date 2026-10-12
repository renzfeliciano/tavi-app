import { eq } from "drizzle-orm";
import { marketFor } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { todayIn } from "@/shared/dates/calendar";
import {
  parseRegistration,
  REGISTRATION_FIELDS,
  type RegistrationDetails,
  type RegistrationField,
} from "../domain/registration";
import { organizations } from "../schema";

const registrationColumns = {
  taxpayerType: organizations.taxpayerType,
  incomeTaxOption: organizations.incomeTaxOption,
  taxOfficeCode: organizations.taxOfficeCode,
  taxRegisteredOn: organizations.taxRegisteredOn,
  lineOfBusiness: organizations.lineOfBusiness,
  industryCode: organizations.industryCode,
  nameRegistrationAuthority: organizations.nameRegistrationAuthority,
  nameRegistrationNumber: organizations.nameRegistrationNumber,
  nameRegistrationScope: organizations.nameRegistrationScope,
  nameRegistrationValidFrom: organizations.nameRegistrationValidFrom,
  nameRegistrationValidUntil: organizations.nameRegistrationValidUntil,
};

/** The registration details with the profile fields they depend on. */
export type BusinessRegistration = RegistrationDetails & {
  taxId: string | null;
  taxRegistration: string | null;
  timezone: string;
};

export type UpdateRegistrationResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<RegistrationField | "form", string>> };

/** How the business is registered. Owners and admins only: it holds tax details. */
export async function getBusinessRegistration(actor: OrgActor, db: Database = getDb()): Promise<BusinessRegistration> {
  assertCan(actor, "organization.manage");
  const [row] = await db
    .select({
      ...registrationColumns,
      taxId: organizations.taxId,
      taxRegistration: organizations.taxRegistration,
      timezone: organizations.timezone,
    })
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId));
  if (!row) throw new Error("Organization not found");
  return row;
}

/**
 * Saves the registration details. Only the fields that changed are audited,
 * by name: the log never copies a number or a date.
 */
export async function updateBusinessRegistration(
  actor: OrgActor,
  input: unknown,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<UpdateRegistrationResult> {
  assertCan(actor, "organization.manage");

  return db.transaction(async (tx): Promise<UpdateRegistrationResult> => {
    const [row] = await tx
      .select({
        ...registrationColumns,
        countryCode: organizations.countryCode,
        taxRegistration: organizations.taxRegistration,
        timezone: organizations.timezone,
      })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    if (!row) throw new Error("Organization not found");

    const config = marketFor(row.countryCode).registration;
    if (!config) return { ok: false, errors: { form: "Registration details aren't available in your country yet." } };

    const parsed = parseRegistration(config, input, {
      taxRegistration: row.taxRegistration,
      today: todayIn(row.timezone, now),
    });
    if (!parsed.ok) return parsed;

    const changed = REGISTRATION_FIELDS.filter((field) => parsed.details[field] !== row[field]);
    if (changed.length === 0) return { ok: true };

    await tx.update(organizations).set(parsed.details).where(eq(organizations.id, actor.organizationId));
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
