import "server-only";
import { getDb, type Database } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { revokeOrganizationShareLinks } from "@/modules/documents";
import { anonymiseUser } from "@/modules/identity";
import { closeOrganization, listMembershipsForClosure, removeMembership } from "@/modules/organizations";

export type CloseAccountResult =
  | { ok: true; closedBusinesses: number }
  | { ok: false; error: "shared_business" | "already_closed" };

/**
 * Closes a person's account (D16), once their password has been checked:
 *
 * - every business where they're the only member is closed: its records stay,
 *   because tax rules require them, but its customer links stop working and
 *   daily jobs leave it alone;
 * - they leave every business they share with others (D17);
 * - their sign-in goes (password, sessions, pending links) and their name and
 *   email are replaced; the row stays for the activity history.
 *
 * If they own a business that others still use, the request is refused and
 * nothing changes: they transfer ownership first. All in one transaction.
 */
export async function closeAccount(userId: string, db: Database = getDb()): Promise<CloseAccountResult> {
  return db.transaction(async (tx) => {
    const memberships = await listMembershipsForClosure(tx, userId);
    if (memberships.some((m) => m.memberCount > 1 && m.role === "owner")) {
      return { ok: false, error: "shared_business" } as const;
    }

    const previousEmail = await anonymiseUser(tx, userId);
    if (!previousEmail) return { ok: false, error: "already_closed" } as const;

    let closedBusinesses = 0;
    for (const membership of memberships) {
      if (membership.memberCount > 1) {
        await removeMembership(tx, membership.organizationId, userId);
        continue;
      }
      if (!(await closeOrganization(tx, membership.organizationId))) continue;
      closedBusinesses += 1;
      const linksClosed = await revokeOrganizationShareLinks(tx, membership.organizationId);
      await recordAuditEvent(tx, {
        action: "organization.closed",
        actorType: "user",
        actorId: userId,
        organizationId: membership.organizationId,
        entityType: "organization",
        entityId: membership.organizationId,
        metadata: { linksClosed },
      });
    }

    await recordAuditEvent(tx, {
      action: "auth.account_closed",
      actorType: "user",
      actorId: userId,
      entityType: "user",
      entityId: userId,
      metadata: { closedBusinesses },
    });
    return { ok: true, closedBusinesses } as const;
  });
}
