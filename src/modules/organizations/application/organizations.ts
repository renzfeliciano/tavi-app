import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { marketFor } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import type { Role } from "@/modules/authz";
import { organizationInputSchema } from "../domain/organization-input";
import { memberships, organizations } from "../schema";

type Organization = typeof organizations.$inferSelect;

export type CreateOrganizationResult =
  | { ok: true; organization: Organization }
  | { ok: false; fieldErrors: Partial<Record<"name" | "currency" | "country", string[]>> };

/**
 * Creates a business and makes `userId` its owner, in one transaction.
 * `userId` comes from the server-side session, never from the client. Locale,
 * time zone, tax mode and document defaults come from the country's market
 * profile.
 */
export async function createOrganizationForUser(
  userId: string,
  input: unknown,
  db: Database = getDb(),
): Promise<CreateOrganizationResult> {
  const parsed = organizationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const organization = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values(newOrganizationValues(parsed.data))
      .returning();
    if (!org) throw new Error("Organization insert returned no row");
    await tx.insert(memberships).values({ organizationId: org.id, userId, role: "owner" });
    await recordAuditEvent(tx, {
      action: "organization.created",
      actorType: "user",
      actorId: userId,
      organizationId: org.id,
      entityType: "organization",
      entityId: org.id,
      metadata: { name: org.name, currency: org.defaultCurrency, country: org.countryCode },
    });
    return org;
  });

  return { ok: true, organization };
}

/** The row for a new business in `country`, with its market's defaults. */
export function newOrganizationValues(input: { name: string; currency: string; country: string }) {
  const market = marketFor(input.country);
  return {
    name: input.name,
    countryCode: market.country,
    defaultCurrency: input.currency,
    locale: market.locale,
    timezone: market.timezone,
    taxMode: market.defaultTaxMode,
    quoteValidityDays: market.quoteValidityDays,
    paymentTermsDays: market.paymentTermsDays,
  } satisfies typeof organizations.$inferInsert;
}

export type ResolvedMembership = {
  organizationId: string;
  organizationName: string;
  role: Role;
  /** The business's market and formatting settings. */
  countryCode: string;
  currency: string;
  locale: string;
  timezone: string;
};

/**
 * Which organization a user is acting in: the session's active organization
 * if (and only if) they're a member of it, otherwise their oldest membership.
 * An active organization they don't belong to is ignored, never trusted (§8).
 */
export async function resolveMembership(
  userId: string,
  activeOrganizationId: string | null | undefined,
  db: Database = getDb(),
): Promise<ResolvedMembership | null> {
  const [row] = await db
    .select({
      organizationId: memberships.organizationId,
      organizationName: organizations.name,
      role: memberships.role,
      countryCode: organizations.countryCode,
      currency: organizations.defaultCurrency,
      locale: organizations.locale,
      timezone: organizations.timezone,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId))
    .orderBy(
      // The active organization first (Postgres rejects a constant ORDER BY,
      // so the term is only added when there is one)…
      ...(activeOrganizationId
        ? [desc(sql`${memberships.organizationId} = ${activeOrganizationId}`)]
        : []),
      // …otherwise the oldest membership.
      asc(memberships.createdAt),
      asc(memberships.id),
    )
    .limit(1);

  return row ?? null;
}

/** A business's members and their roles, oldest first (no session: for notifying the business). */
export async function listMembers(
  organizationId: string,
  db: Database = getDb(),
): Promise<{ userId: string; role: Role }[]> {
  return db
    .select({ userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(memberships.createdAt));
}
