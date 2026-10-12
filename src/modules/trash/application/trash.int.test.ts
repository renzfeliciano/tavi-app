import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { ForbiddenError } from "@/modules/authz";
import {
  discardTrashItem,
  emptyTrash,
  listTrash,
  purgeExpiredTrash,
  putInTrash,
  takeFromTrash,
} from "./trash";

const NOW = new Date("2026-10-01T02:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

beforeEach(async () => {
  await resetTables();
});
afterAll(closeTestDb);

async function member(role: Role = "owner", organizationId?: string): Promise<OrgActor> {
  const org = organizationId ? { id: organizationId } : await createTestOrganization(testDb());
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
  return { organizationId: org.id, userId: user.id, role };
}

const entry = (overrides: Partial<Parameters<typeof putInTrash>[2]> = {}) => ({
  kind: "invoice" as const,
  originalId: crypto.randomUUID(),
  customerName: "Juan Dela Cruz",
  totalMinor: 80_000,
  currency: "PHP",
  payload: { v: 1, lines: [] },
  ...overrides,
});

describe("the recycle bin", () => {
  it("keeps a deleted draft for 30 days and lists it newest first", async () => {
    const actor = await member();
    await testDb().transaction(async (tx) => {
      await putInTrash(tx, actor, entry({ customerName: "First" }), NOW);
      await putInTrash(tx, actor, entry({ customerName: "Second", kind: "quote" }), day(1));
    });

    const items = await listTrash(actor, testDb(), day(2));
    expect(items.map((i) => i.customerName)).toEqual(["Second", "First"]);
    expect(items[1]).toMatchObject({ kind: "invoice", customerName: "First", totalMinor: 80_000, currency: "PHP", daysLeft: 28 });
  });

  it("hands back what was kept, once, and removes it from the bin", async () => {
    const actor = await member();
    const draft = entry();
    const trashId = await testDb().transaction((tx) => putInTrash(tx, actor, draft, NOW));

    const taken = await testDb().transaction((tx) => takeFromTrash(tx, actor, "invoice", trashId, day(1)));
    expect(taken).toMatchObject({ originalId: draft.originalId, payload: { v: 1, lines: [] } });
    expect(await listTrash(actor, testDb(), day(1))).toEqual([]);
    expect(await testDb().transaction((tx) => takeFromTrash(tx, actor, "invoice", trashId, day(1)))).toBeNull();
  });

  it("won't hand back an item that has lapsed, another kind, or another business's", async () => {
    const actor = await member();
    const other = await member();
    const trashId = await testDb().transaction((tx) => putInTrash(tx, actor, entry(), NOW));

    expect(await testDb().transaction((tx) => takeFromTrash(tx, actor, "quote", trashId, day(1)))).toBeNull();
    expect(await testDb().transaction((tx) => takeFromTrash(tx, other, "invoice", trashId, day(1)))).toBeNull();
    expect(await testDb().transaction((tx) => takeFromTrash(tx, actor, "invoice", trashId, day(31)))).toBeNull();
    expect(await listTrash(actor, testDb(), day(31))).toEqual([]);
  });

  it("lists deleted bills and quotes together for anyone who can write them", async () => {
    const actor = await member();
    await testDb().transaction(async (tx) => {
      await putInTrash(tx, actor, entry(), NOW);
      await putInTrash(tx, actor, entry({ kind: "quote" }), NOW);
    });
    expect((await listTrash(actor, testDb(), NOW)).map((i) => i.kind).sort()).toEqual(["invoice", "quote"]);
    expect(await listTrash({ ...actor, role: "member" }, testDb(), NOW)).toHaveLength(2);
  });

  it("lets an owner or admin delete one item forever, and records it", async () => {
    const actor = await member("admin");
    const trashId = await testDb().transaction((tx) => putInTrash(tx, actor, entry({ customerName: "Gone" }), NOW));

    expect(await discardTrashItem(actor, trashId, testDb())).toEqual({ ok: true });
    expect(await listTrash(actor, testDb(), NOW)).toEqual([]);
    expect(await discardTrashItem(actor, trashId, testDb())).toEqual({ ok: false, notFound: true });
    const events = await listAllAuditEvents(testDb());
    expect(events.at(-1)).toMatchObject({ action: "trash.item_deleted", metadata: { kind: "invoice", customerName: "Gone", totalMinor: 80_000 } });
  });

  it("keeps deleting forever and emptying to owners and admins", async () => {
    const owner = await member("owner");
    const regular = await member("member", owner.organizationId);
    const trashId = await testDb().transaction((tx) => putInTrash(tx, owner, entry(), NOW));

    await expect(discardTrashItem(regular, trashId, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(emptyTrash(regular, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listTrash(owner, testDb(), NOW)).toHaveLength(1);
  });

  it("empties the whole bin of one business and no other", async () => {
    const actor = await member();
    const other = await member();
    await testDb().transaction(async (tx) => {
      await putInTrash(tx, actor, entry(), NOW);
      await putInTrash(tx, actor, entry({ kind: "quote" }), NOW);
      await putInTrash(tx, other, entry(), NOW);
    });

    expect(await emptyTrash(actor, testDb())).toEqual({ ok: true, removed: 2 });
    expect(await listTrash(actor, testDb(), NOW)).toEqual([]);
    expect(await listTrash(other, testDb(), NOW)).toHaveLength(1);
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "trash.emptied", metadata: { removed: 2 } });
  });

  it("removes lapsed items for good and says so in each business's history", async () => {
    const actor = await member();
    const other = await member();
    await testDb().transaction(async (tx) => {
      await putInTrash(tx, actor, entry({ customerName: "Old" }), NOW);
      await putInTrash(tx, actor, entry({ customerName: "Recent" }), day(20));
      await putInTrash(tx, other, entry({ customerName: "Old elsewhere" }), NOW);
    });

    expect(await purgeExpiredTrash(testDb(), day(31))).toBe(2);
    expect((await listTrash(actor, testDb(), day(31))).map((i) => i.customerName)).toEqual(["Recent"]);
    const purged = (await listAllAuditEvents(testDb())).filter((e) => e.action === "trash.purged");
    expect(purged).toHaveLength(2);
    expect(purged.every((e) => e.actorType === "system")).toBe(true);
    expect(await purgeExpiredTrash(testDb(), day(31))).toBe(0);
  });
});
