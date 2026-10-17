import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { accounts, memberships, organizations, sessions, shareLinks, users, verifications } from "@/db/schema";
import { createShareLink } from "@/modules/documents";
import { listOrganizationClocks } from "@/modules/organizations";
import { closeAccount } from "./closure";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

async function ownerWithBusiness(email = "maria@example.com") {
  const db = testDb();
  const user = await createTestUser(db, { email });
  const org = await createTestOrganization(db, { name: `Business of ${email}` });
  await addTestMembership(db, { organizationId: org.id, userId: user.id, role: "owner" });
  await db.insert(accounts).values({ userId: user.id, accountId: user.id, providerId: "credential", password: "hash" });
  await db.insert(sessions).values({ userId: user.id, token: `token-${user.id}`, expiresAt: new Date(Date.now() + 86_400_000) });
  await db.insert(verifications).values({
    identifier: "reset-password:abc",
    value: user.id,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  await createShareLink(db, {
    organizationId: org.id,
    documentKind: "quote",
    documentId: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 86_400_000),
    createdBy: user.id,
  });
  return { user, org };
}

describe("closeAccount", () => {
  it("removes the sign-in, anonymises the person and closes their own business", async () => {
    const db = testDb();
    const { user, org } = await ownerWithBusiness();
    const other = await ownerWithBusiness("other@example.com");

    expect(await closeAccount(user.id, db)).toEqual({ ok: true, closedBusinesses: 1 });

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row).toMatchObject({ name: "Closed account", emailVerified: false });
    expect(row?.email).toBe(`closed-${user.id}@closed.invalid`);
    expect(row?.closedAt).toBeInstanceOf(Date);
    expect(await db.select().from(accounts).where(eq(accounts.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(verifications).where(eq(verifications.value, user.id))).toHaveLength(0);

    const [business] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    expect(business?.closedAt).toBeInstanceOf(Date);
    const links = await db.select().from(shareLinks).where(eq(shareLinks.organizationId, org.id));
    expect(links.every((l) => l.revokedAt !== null)).toBe(true);
    expect((await listOrganizationClocks(db)).map((c) => c.organizationId)).toEqual([other.org.id]);

    // The other business and its owner are untouched.
    const [otherUser] = await db.select().from(users).where(eq(users.id, other.user.id));
    expect(otherUser?.email).toBe("other@example.com");
    const otherLinks = await db.select().from(shareLinks).where(eq(shareLinks.organizationId, other.org.id));
    expect(otherLinks.every((l) => l.revokedAt === null)).toBe(true);

    const events = (await listAllAuditEvents()).map((e) => [e.action, e.organizationId, e.metadata]);
    expect(events).toEqual([
      ["organization.closed", org.id, { linksClosed: 1 }],
      ["auth.account_closed", null, { closedBusinesses: 1 }],
    ]);
  });

  it("frees the email for a new sign-up", async () => {
    const db = testDb();
    const { user } = await ownerWithBusiness();
    await closeAccount(user.id, db);
    await expect(createTestUser(db, { email: "maria@example.com" })).resolves.toBeTruthy();
  });

  it("refuses, changing nothing, when they own a business others still use", async () => {
    const db = testDb();
    const { user, org } = await ownerWithBusiness();
    const colleague = await createTestUser(db, { email: "colleague@example.com" });
    await addTestMembership(db, { organizationId: org.id, userId: colleague.id, role: "member" });

    expect(await closeAccount(user.id, db)).toEqual({ ok: false, error: "shared_business" });
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row?.email).toBe("maria@example.com");
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(1);
    expect(await listAllAuditEvents()).toEqual([]);
  });

  it("leaves a business someone else owns, and closes only their own", async () => {
    const db = testDb();
    const { user, org } = await ownerWithBusiness();
    const boss = await ownerWithBusiness("boss@example.com");
    await addTestMembership(db, { organizationId: boss.org.id, userId: user.id, role: "member" });

    expect(await closeAccount(user.id, db)).toEqual({ ok: true, closedBusinesses: 1 });

    const [own] = await db.select().from(organizations).where(eq(organizations.id, org.id));
    const [bosses] = await db.select().from(organizations).where(eq(organizations.id, boss.org.id));
    expect(own?.closedAt).toBeInstanceOf(Date);
    expect(bosses?.closedAt).toBeNull();
    expect(await db.select().from(memberships).where(eq(memberships.userId, user.id))).toEqual([
      expect.objectContaining({ organizationId: org.id }),
    ]);
    expect((await listAllAuditEvents()).map((e) => e.action)).toContain("team.member_left");
  });

  it("does nothing the second time", async () => {
    const db = testDb();
    const { user } = await ownerWithBusiness();
    await closeAccount(user.id, db);
    expect(await closeAccount(user.id, db)).toEqual({ ok: false, error: "already_closed" });
    expect((await listAllAuditEvents()).filter((e) => e.action === "auth.account_closed")).toHaveLength(1);
  });

  it("closes an account that never set up a business", async () => {
    const db = testDb();
    const user = await createTestUser(db, { email: "new@example.com" });
    expect(await closeAccount(user.id, db)).toEqual({ ok: true, closedBusinesses: 0 });
  });
});
