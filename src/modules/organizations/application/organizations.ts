import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import type { Role } from "@/modules/authz";
import { organizationInputSchema } from "../domain/organization-input";
import { memberships, organizations } from "../schema";

type Organization = typeof organizations.$inferSelect;

export type CreateOrganizationResult =
  | { ok: true; organization: Organization }
  | { ok: false; fieldErrors: Partial<Record<"name" | "currency", string[]>> };

/**
 * Creates a business and makes `userId` its owner, in one transaction.
 * `userId` comes from the server-side session, never from the client.
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
      .values({ name: parsed.data.name, defaultCurrency: parsed.data.currency })
      .returning();
    if (!org) throw new Error("Organization insert returned no row");
    await tx.insert(memberships).values({ organizationId: org.id, userId, role: "owner" });
    return org;
  });

  return { ok: true, organization };
}

export type ResolvedMembership = {
  organizationId: string;
  organizationName: string;
  role: Role;
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
