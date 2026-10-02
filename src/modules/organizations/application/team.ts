import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb, isUniqueViolation } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor, type Role } from "@/modules/authz";
import { users } from "@/db/schema";
import {
  documentEmailLimitMessage,
  documentEmailsAllowed,
  enqueueEmail,
  teamInvitationEmail,
} from "@/modules/notifications";
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  canManageMember,
  invitationInputSchema,
  invitationLifetime,
  invitationState,
  type InvitationState,
  ROLE_LABELS,
  sameEmail,
  TEAM_LIMITS,
  teamFullMessage,
} from "../domain/team";
import { hashInvitationToken, looksLikeInvitationToken, newInvitationToken } from "../infra/invitation-tokens";
import { invitations, memberships, organizations } from "../schema";

// Teams (Phase 2.1, D17). Names and emails of members are read from the
// identity module's `users` table with a read-only join: identity already
// depends on this module (resolveMembership), so it can't be called from here.

export type TeamMember = { userId: string; name: string; email: string; role: Role; joinedAt: Date };
export type PendingInvitation = {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: Date;
  createdAt: Date;
  state: Extract<InvitationState, "open" | "expired">;
};

/** Everyone in the business and the invitations not yet accepted or cancelled. Every role can see it. */
export async function listTeam(
  actor: OrgActor,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<{ members: TeamMember[]; invitations: PendingInvitation[] }> {
  const members = await db
    .select({
      userId: memberships.userId,
      name: users.name,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, actor.organizationId))
    .orderBy(sql`case ${memberships.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(users.name));

  const pending = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, actor.organizationId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .orderBy(asc(invitations.createdAt));

  return {
    members,
    // Accepted and cancelled ones were filtered out above, so each is open or expired.
    invitations: pending.map((row) => ({
      ...row,
      state: invitationState({ expiresAt: row.expiresAt, acceptedAt: null, revokedAt: null }, now) as "open" | "expired",
    })),
  };
}

export type InviteResult =
  | { ok: true; email: string; resent: boolean }
  | { ok: false; fieldErrors: Partial<Record<"email" | "role", string[]>> }
  | { ok: false; error: string };

/**
 * Invites someone by email. Inviting an address that already has an
 * invitation sends a fresh one and cancels the old link. Counts people and
 * open invitations under a lock on the business, so two invites at once can't
 * pass the team limit.
 */
export async function inviteMember(
  actor: OrgActor & { userName: string; organizationName: string },
  input: unknown,
  options: { appUrl: string },
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<InviteResult> {
  assertCan(actor, "users.manage");
  const parsed = invitationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { email, role } = parsed.data;
  // Checked before anything changes, like every command that sends email (§I).
  if (!(await documentEmailsAllowed(db, actor.organizationId, now))) {
    return { ok: false, error: documentEmailLimitMessage() };
  }

  try {
    return await db.transaction(async (tx) => {
      await lockOrganization(tx, actor.organizationId);

      const [member] = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.organizationId, actor.organizationId), eq(users.email, email)));
      if (member) return { ok: false, fieldErrors: { email: ["This person is already in your team."] } } as const;

      // Any earlier invitation to this address (open or expired) gives way to the new one.
      const replaced = await tx
        .update(invitations)
        .set({ revokedAt: now })
        .where(
          and(
            eq(invitations.organizationId, actor.organizationId),
            eq(invitations.email, email),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        )
        .returning({ id: invitations.id });

      const [people] = await tx
        .select({ n: count() })
        .from(memberships)
        .where(eq(memberships.organizationId, actor.organizationId));
      const [open] = await tx
        .select({ n: count() })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, actor.organizationId),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
            gt(invitations.expiresAt, now),
          ),
        );
      if (Number(people?.n ?? 0) + Number(open?.n ?? 0) >= TEAM_LIMITS.maxPeople) {
        throw new TeamFullError();
      }

      const { token, tokenHash } = newInvitationToken();
      const [invitation] = await tx
        .insert(invitations)
        .values({
          organizationId: actor.organizationId,
          email,
          role,
          tokenHash,
          invitedBy: actor.userId,
          expiresAt: new Date(now.getTime() + TEAM_LIMITS.invitationSeconds * 1000),
        })
        .returning({ id: invitations.id });
      if (!invitation) throw new Error("Invitation insert returned no row");

      await recordAuditEvent(tx, {
        action: "team.invited",
        actorType: "user",
        actorId: actor.userId,
        organizationId: actor.organizationId,
        entityType: "invitation",
        entityId: invitation.id,
        metadata: { role, resent: replaced.length > 0 },
      });
      await enqueueEmail(
        tx,
        teamInvitationEmail({
          to: email,
          businessName: actor.organizationName,
          inviterName: actor.userName,
          roleLabel: ROLE_LABELS[role],
          url: `${options.appUrl.replace(/\/$/, "")}/invite/${token}`,
          expiresIn: invitationLifetime(),
        }),
        { organizationId: actor.organizationId },
      );
      return { ok: true, email, resent: replaced.length > 0 } as const;
    });
  } catch (error) {
    if (error instanceof TeamFullError) return { ok: false, error: teamFullMessage() };
    // Someone else invited the same address at the same moment.
    if (isUniqueViolation(error)) return { ok: false, fieldErrors: { email: ["There's already an invitation for this address."] } };
    throw error;
  }
}

class TeamFullError extends Error {}

/** Cancels an invitation that hasn't been accepted; its link stops working. */
export async function revokeInvitation(
  actor: OrgActor,
  invitationId: string,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<{ ok: true; email: string } | { ok: false }> {
  assertCan(actor, "users.manage");
  if (!z.uuid().safeParse(invitationId).success) return { ok: false };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(invitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.organizationId, actor.organizationId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      )
      .returning({ id: invitations.id, email: invitations.email });
    if (!row) return { ok: false } as const;
    await recordAuditEvent(tx, {
      action: "team.invitation_revoked",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "invitation",
      entityId: row.id,
    });
    return { ok: true, email: row.email } as const;
  });
}

export type MemberChangeResult = { ok: true; name: string } | { ok: false; error: string };

const NOT_IN_TEAM = "That person isn't in your team any more. Reload the page.";

/** Makes someone an admin or a member. Not the owner (transfer instead), not yourself. */
export async function changeMemberRole(
  actor: OrgActor,
  userId: string,
  role: unknown,
  db: Database = getDb(),
): Promise<MemberChangeResult> {
  assertCan(actor, "users.manage");
  const next = z.enum(ASSIGNABLE_ROLES).safeParse(role);
  if (!next.success || !z.uuid().safeParse(userId).success) return { ok: false, error: "Choose a role." };
  return db.transaction(async (tx) => {
    const target = await lockMember(tx, actor.organizationId, userId);
    if (!target) return { ok: false, error: NOT_IN_TEAM } as const;
    if (!canManageMember(actor, target)) return { ok: false, error: "You can't change this person's role." } as const;
    if (target.role === next.data) return { ok: true, name: target.name } as const;
    await tx
      .update(memberships)
      .set({ role: next.data })
      .where(and(eq(memberships.organizationId, actor.organizationId), eq(memberships.userId, userId)));
    await recordAuditEvent(tx, {
      action: "team.role_changed",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "user",
      entityId: userId,
      metadata: { from: target.role, to: next.data },
    });
    return { ok: true, name: target.name } as const;
  });
}

/** Removes someone from the business. They're signed in still, but lose access at once. */
export async function removeMember(actor: OrgActor, userId: string, db: Database = getDb()): Promise<MemberChangeResult> {
  assertCan(actor, "users.manage");
  if (!z.uuid().safeParse(userId).success) return { ok: false, error: NOT_IN_TEAM };
  return db.transaction(async (tx) => {
    const target = await lockMember(tx, actor.organizationId, userId);
    if (!target) return { ok: false, error: NOT_IN_TEAM } as const;
    if (!canManageMember(actor, target)) return { ok: false, error: "You can't remove this person." } as const;
    await deleteMembership(tx, actor.organizationId, userId);
    await recordAuditEvent(tx, {
      action: "team.member_removed",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "user",
      entityId: userId,
      metadata: { role: target.role },
    });
    return { ok: true, name: target.name } as const;
  });
}

/** Leaves the business. The owner can't: they transfer ownership first. */
export async function leaveBusiness(actor: OrgActor, db: Database = getDb()): Promise<{ ok: true } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    const self = await lockMember(tx, actor.organizationId, actor.userId);
    if (!self) return { ok: true } as const;
    if (self.role === "owner") {
      return { ok: false, error: "Make someone else the owner before you leave." } as const;
    }
    await removeMembership(tx, actor.organizationId, actor.userId);
    return { ok: true } as const;
  });
}

/**
 * Hands the business to another member: they become the owner and the
 * current owner becomes an admin, in one transaction.
 */
export async function transferOwnership(actor: OrgActor, userId: string, db: Database = getDb()): Promise<MemberChangeResult> {
  assertCan(actor, "ownership.transfer");
  if (!z.uuid().safeParse(userId).success || userId === actor.userId) return { ok: false, error: NOT_IN_TEAM };
  return db.transaction(async (tx) => {
    const self = await lockMember(tx, actor.organizationId, actor.userId);
    const target = await lockMember(tx, actor.organizationId, userId);
    if (!self || self.role !== "owner") return { ok: false, error: "Only the owner can do this." } as const;
    if (!target) return { ok: false, error: NOT_IN_TEAM } as const;
    await tx
      .update(memberships)
      .set({ role: "admin" })
      .where(and(eq(memberships.organizationId, actor.organizationId), eq(memberships.userId, actor.userId)));
    await tx
      .update(memberships)
      .set({ role: "owner" })
      .where(and(eq(memberships.organizationId, actor.organizationId), eq(memberships.userId, userId)));
    await recordAuditEvent(tx, {
      action: "team.ownership_transferred",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "user",
      entityId: userId,
      metadata: { previousRole: target.role },
    });
    return { ok: true, name: target.name } as const;
  });
}

/**
 * Removes a person's own membership and audits it as leaving. Shared with
 * account closure (privacy module), which runs it inside its own transaction.
 */
export async function removeMembership(executor: Executor, organizationId: string, userId: string): Promise<void> {
  await deleteMembership(executor, organizationId, userId);
  await recordAuditEvent(executor, {
    action: "team.member_left",
    actorType: "user",
    actorId: userId,
    organizationId,
    entityType: "user",
    entityId: userId,
  });
}

export type InvitationPreview = {
  state: InvitationState;
  businessName: string;
  email: string;
  role: AssignableRole;
  inviterName: string | null;
};

/** What the invitation page shows. Null for a token that matches nothing (same answer as malformed). */
export async function previewInvitation(
  token: unknown,
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<InvitationPreview | null> {
  if (!looksLikeInvitationToken(token)) return null;
  const [row] = await db
    .select({
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
      businessName: organizations.name,
      closedAt: organizations.closedAt,
      inviterName: users.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .leftJoin(users, eq(users.id, invitations.invitedBy))
    .where(eq(invitations.tokenHash, hashInvitationToken(token)));
  if (!row) return null;
  const state: InvitationState = row.closedAt ? "cancelled" : invitationState(row, now);
  return { state, businessName: row.businessName, email: row.email, role: row.role, inviterName: row.inviterName };
}

export type AcceptInvitationResult =
  | { ok: true; organizationId: string; organizationName: string }
  | { ok: false; error: "unavailable" | "wrong_email" };

/**
 * The signed-in person joins the business. Their account email must be the
 * invited address; the token alone isn't enough, so a forwarded email can't be
 * used by someone else. Accepting twice is harmless.
 */
export async function acceptInvitation(
  token: unknown,
  user: { id: string; email: string },
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<AcceptInvitationResult> {
  if (!looksLikeInvitationToken(token)) return { ok: false, error: "unavailable" };
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashInvitationToken(token)))
      .for("update");
    if (!invitation) return { ok: false, error: "unavailable" } as const;
    const [business] = await tx
      .select({ name: organizations.name, closedAt: organizations.closedAt })
      .from(organizations)
      .where(eq(organizations.id, invitation.organizationId))
      .for("update");
    if (!business || business.closedAt) return { ok: false, error: "unavailable" } as const;

    if (invitation.acceptedAt && invitation.acceptedBy === user.id) {
      return { ok: true, organizationId: invitation.organizationId, organizationName: business.name } as const;
    }
    if (invitationState(invitation, now) !== "open") return { ok: false, error: "unavailable" } as const;
    if (!sameEmail(invitation.email, user.email)) return { ok: false, error: "wrong_email" } as const;

    const [existing] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.organizationId, invitation.organizationId), eq(memberships.userId, user.id)));
    if (!existing) {
      await tx
        .insert(memberships)
        .values({ organizationId: invitation.organizationId, userId: user.id, role: invitation.role });
    }
    await tx
      .update(invitations)
      .set({ acceptedAt: now, acceptedBy: user.id })
      .where(eq(invitations.id, invitation.id));
    await recordAuditEvent(tx, {
      action: "team.invitation_accepted",
      actorType: "user",
      actorId: user.id,
      organizationId: invitation.organizationId,
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { role: existing?.role ?? invitation.role },
    });
    return { ok: true, organizationId: invitation.organizationId, organizationName: business.name } as const;
  });
}

/** The businesses someone can switch between, oldest membership first. Closed ones aren't listed. */
export async function listMyBusinesses(
  userId: string,
  db: Database = getDb(),
): Promise<{ organizationId: string; name: string; role: Role }[]> {
  return db
    .select({ organizationId: memberships.organizationId, name: organizations.name, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), isNull(organizations.closedAt)))
    .orderBy(asc(memberships.createdAt), asc(memberships.id));
}

async function lockOrganization(executor: Executor, organizationId: string): Promise<void> {
  await executor
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for("update");
}

async function lockMember(executor: Executor, organizationId: string, userId: string) {
  const [row] = await executor
    .select({ userId: memberships.userId, role: memberships.role, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)))
    .for("update", { of: memberships });
  return row ?? null;
}

async function deleteMembership(executor: Executor, organizationId: string, userId: string): Promise<void> {
  await executor
    .delete(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)));
}

/** The team and its invitations for "Download your data" (D16). Token hashes are left out. */
export async function exportTeam(executor: Executor, organizationId: string) {
  const people = await executor
    .select({ userId: memberships.userId, name: users.name, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(memberships.createdAt));
  const invited = await executor
    .select({
      email: invitations.email,
      role: invitations.role,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
    })
    .from(invitations)
    .where(eq(invitations.organizationId, organizationId))
    .orderBy(asc(invitations.createdAt));
  return { members: people, invitations: invited };
}
