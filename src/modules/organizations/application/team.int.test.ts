import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  listAllOutboxMessages,
  resetTables,
  testDb,
} from "@/db/testing";
import type { Role } from "@/modules/authz";
import { TEAM_LIMITS } from "../domain/team";
import { invitations, memberships } from "../schema";
import { closeOrganization } from "./organizations";
import {
  acceptInvitation,
  changeMemberRole,
  inviteMember,
  leaveBusiness,
  listMyBusinesses,
  listTeam,
  previewInvitation,
  removeMember,
  revokeInvitation,
  transferOwnership,
} from "./team";

const APP_URL = "https://tavi.example";
const NOW = new Date("2026-10-02T03:00:00Z");

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

async function business(name = "Santos Aircon") {
  const db = testDb();
  const org = await createTestOrganization(db, { name });
  const owner = await createTestUser(db, { email: `owner-${crypto.randomUUID()}@example.com`, name: "Maria Santos" });
  await addTestMembership(db, { organizationId: org.id, userId: owner.id, role: "owner" });
  const actor = (userId: string, role: Role, userName = "Maria Santos") => ({
    organizationId: org.id,
    organizationName: name,
    userId,
    userName,
    role,
  });
  return { org, owner, ownerActor: actor(owner.id, "owner"), actor };
}

async function person(email: string, name = "Ana Reyes") {
  return createTestUser(testDb(), { email, name });
}

/** Invites and returns the token from the queued email. */
async function invite(actor: Parameters<typeof inviteMember>[0], email: string, role = "member") {
  const result = await inviteMember(actor, { email, role }, { appUrl: APP_URL }, testDb(), NOW);
  if (!result.ok) throw new Error(`invite failed: ${JSON.stringify(result)}`);
  const messages = await listAllOutboxMessages();
  const text = String((messages.at(-1)?.payload as { text?: string }).text);
  const token = /\/invite\/([A-Za-z0-9_-]{43})/.exec(text)?.[1];
  if (!token) throw new Error("no token in email");
  return token;
}

describe("inviting", () => {
  it("emails a link, stores only the token's hash and audits it", async () => {
    const { ownerActor, org } = await business();
    const token = await invite(ownerActor, "Ana@Example.com", "admin");

    const [row] = await testDb().select().from(invitations).where(eq(invitations.organizationId, org.id));
    expect(row).toMatchObject({ email: "ana@example.com", role: "admin" });
    expect(row?.tokenHash).not.toContain(token);
    expect(row?.expiresAt.getTime()).toBe(NOW.getTime() + TEAM_LIMITS.invitationSeconds * 1000);

    const [email] = await listAllOutboxMessages();
    expect(email?.organizationId).toBe(org.id);
    expect(email?.payload).toMatchObject({ to: "ana@example.com", subject: "Maria Santos invited you to Santos Aircon on Tavi" });
    expect((await listAllAuditEvents()).map((e) => [e.action, e.metadata])).toEqual([
      ["team.invited", { role: "admin", resent: false }],
    ]);
  });

  it("replaces an earlier invitation to the same address, so the old link stops working", async () => {
    const { ownerActor } = await business();
    const first = await invite(ownerActor, "ana@example.com");
    const second = await invite(ownerActor, "ana@example.com");
    expect((await previewInvitation(first, testDb(), NOW))?.state).toBe("cancelled");
    expect((await previewInvitation(second, testDb(), NOW))?.state).toBe("open");
  });

  it("refuses someone already in the team", async () => {
    const { ownerActor, owner } = await business();
    const result = await inviteMember(ownerActor, { email: owner.email, role: "member" }, { appUrl: APP_URL }, testDb(), NOW);
    expect(result).toEqual({ ok: false, fieldErrors: { email: ["This person is already in your team."] } });
  });

  it("stops at the team limit, counting open invitations", async () => {
    const { ownerActor } = await business();
    for (let i = 1; i < TEAM_LIMITS.maxPeople; i++) await invite(ownerActor, `p${i}@example.com`);
    const result = await inviteMember(ownerActor, { email: "one-too-many@example.com", role: "member" }, { appUrl: APP_URL }, testDb(), NOW);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(`up to ${TEAM_LIMITS.maxPeople} people`) });
  });

  it("is for owners and admins", async () => {
    const { actor } = await business();
    const member = await person("member@example.com");
    await expect(
      inviteMember(actor(member.id, "member"), { email: "x@example.com", role: "member" }, { appUrl: APP_URL }, testDb(), NOW),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("never touches another business's invitations", async () => {
    const a = await business("A");
    const b = await business("B");
    await invite(a.ownerActor, "ana@example.com");
    const [row] = await testDb().select().from(invitations);
    expect(await revokeInvitation(b.ownerActor, row!.id, testDb(), NOW)).toEqual({ ok: false });
    expect((await listTeam(b.ownerActor, testDb(), NOW)).invitations).toEqual([]);
  });
});

describe("accepting", () => {
  it("adds the invited person with the invited role, once", async () => {
    const { ownerActor, org } = await business();
    const token = await invite(ownerActor, "ana@example.com", "admin");
    const ana = await person("ana@example.com");

    const result = await acceptInvitation(token, { id: ana.id, email: ana.email }, testDb(), NOW);
    expect(result).toEqual({ ok: true, organizationId: org.id, organizationName: "Santos Aircon" });
    expect(await acceptInvitation(token, { id: ana.id, email: ana.email }, testDb(), NOW)).toMatchObject({ ok: true });

    const rows = await testDb()
      .select()
      .from(memberships)
      .where(and(eq(memberships.organizationId, org.id), eq(memberships.userId, ana.id)));
    expect(rows).toMatchObject([{ role: "admin" }]);
    expect((await listMyBusinesses(ana.id, testDb())).map((b) => b.name)).toEqual(["Santos Aircon"]);
  });

  it("needs the invited email: a forwarded link isn't enough", async () => {
    const { ownerActor } = await business();
    const token = await invite(ownerActor, "ana@example.com");
    const other = await person("someone-else@example.com");
    expect(await acceptInvitation(token, { id: other.id, email: other.email }, testDb(), NOW)).toEqual({
      ok: false,
      error: "wrong_email",
    });
  });

  it.each([
    ["expired", async () => new Date(NOW.getTime() + TEAM_LIMITS.invitationSeconds * 1000)],
  ])("refuses an %s invitation", async (_label, later) => {
    const { ownerActor } = await business();
    const token = await invite(ownerActor, "ana@example.com");
    const ana = await person("ana@example.com");
    expect(await acceptInvitation(token, { id: ana.id, email: ana.email }, testDb(), await later())).toEqual({
      ok: false,
      error: "unavailable",
    });
  });

  it("refuses a cancelled invitation, or one to a closed business", async () => {
    const { ownerActor, org } = await business();
    const cancelled = await invite(ownerActor, "ana@example.com");
    const [row] = await testDb().select().from(invitations);
    await revokeInvitation(ownerActor, row!.id, testDb(), NOW);
    const ana = await person("ana@example.com");
    expect(await acceptInvitation(cancelled, { id: ana.id, email: ana.email }, testDb(), NOW)).toMatchObject({ ok: false });

    const open = await invite(ownerActor, "ana@example.com");
    await closeOrganization(testDb(), org.id);
    expect(await acceptInvitation(open, { id: ana.id, email: ana.email }, testDb(), NOW)).toMatchObject({ ok: false });
    expect((await previewInvitation(open, testDb(), NOW))?.state).toBe("cancelled");
  });

  it("gives the same answer for a malformed or unknown token", async () => {
    expect(await previewInvitation("nope", testDb(), NOW)).toBeNull();
    expect(await previewInvitation("A".repeat(43), testDb(), NOW)).toBeNull();
  });
});

describe("managing the team", () => {
  async function teamWithMember(role: Role = "member") {
    const b = await business();
    const ana = await person("ana@example.com");
    await addTestMembership(testDb(), { organizationId: b.org.id, userId: ana.id, role });
    return { ...b, ana };
  }

  it("changes a role and audits it", async () => {
    const { ownerActor, ana } = await teamWithMember();
    expect(await changeMemberRole(ownerActor, ana.id, "admin", testDb())).toEqual({ ok: true, name: "Ana Reyes" });
    const team = await listTeam(ownerActor, testDb(), NOW);
    expect(team.members.find((m) => m.userId === ana.id)?.role).toBe("admin");
    expect((await listAllAuditEvents()).at(-1)).toMatchObject({ action: "team.role_changed", metadata: { from: "member", to: "admin" } });
  });

  it("never changes or removes the owner, or yourself", async () => {
    const { actor, owner, ana, ownerActor } = await teamWithMember("admin");
    const admin = actor(ana.id, "admin", "Ana Reyes");
    expect(await changeMemberRole(admin, owner.id, "member", testDb())).toMatchObject({ ok: false });
    expect(await removeMember(admin, owner.id, testDb())).toMatchObject({ ok: false });
    expect(await changeMemberRole(admin, ana.id, "member", testDb())).toMatchObject({ ok: false });
    expect(await changeMemberRole(ownerActor, ana.id, "owner", testDb())).toMatchObject({ ok: false });
  });

  it("removes someone, who then has no access", async () => {
    const { ownerActor, ana } = await teamWithMember();
    expect(await removeMember(ownerActor, ana.id, testDb())).toEqual({ ok: true, name: "Ana Reyes" });
    expect(await listMyBusinesses(ana.id, testDb())).toEqual([]);
  });

  it("lets a member leave, but not the owner", async () => {
    const { actor, ownerActor, ana } = await teamWithMember();
    expect(await leaveBusiness(ownerActor, testDb())).toMatchObject({ ok: false });
    expect(await leaveBusiness(actor(ana.id, "member", "Ana Reyes"), testDb())).toEqual({ ok: true });
    expect(await listMyBusinesses(ana.id, testDb())).toEqual([]);
    expect((await listAllAuditEvents()).at(-1)?.action).toBe("team.member_left");
  });

  it("transfers ownership: one owner, the old one becomes an admin", async () => {
    const { ownerActor, ana, owner, actor } = await teamWithMember();
    expect(await transferOwnership(ownerActor, ana.id, testDb())).toEqual({ ok: true, name: "Ana Reyes" });
    const roles = Object.fromEntries((await listTeam(ownerActor, testDb(), NOW)).members.map((m) => [m.userId, m.role]));
    expect(roles).toEqual({ [ana.id]: "owner", [owner.id]: "admin" });
    // The old owner can't do it again.
    await expect(transferOwnership(actor(owner.id, "admin"), ana.id, testDb())).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("is for owners and admins only", async () => {
    const { actor, owner, ana } = await teamWithMember();
    await expect(removeMember(actor(ana.id, "member"), owner.id, testDb())).rejects.toMatchObject({ name: "ForbiddenError" });
  });
});
