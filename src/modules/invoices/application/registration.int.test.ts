import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor, Role } from "@/modules/authz";
import { claimRegisteredSerial, getInvoiceRegistration, saveInvoiceRegistration, turnOffInvoiceRegistration } from "./registration";

const NOW = new Date("2026-10-02T02:00:00Z");
const market = MARKETS.PH;
const form = { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: "1", seriesEnd: "3", title: "Service Invoice" };

async function actorFor(role: Role = "owner"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role });
  return { organizationId: org.id, userId: user.id, role };
}
const save = (actor: OrgActor, raw: unknown = form) => saveInvoiceRegistration(actor, raw, { market, now: NOW }, testDb());
const claim = (actor: OrgActor) => testDb().transaction((tx) => claimRegisteredSerial(tx, actor.organizationId));

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("invoice registration", () => {
  it("is off until the business enters its registration, which is audited", async () => {
    const actor = await actorFor();
    expect(await getInvoiceRegistration(actor, testDb())).toBeNull();
    expect(await claim(actor)).toBeNull();

    expect(await save(actor)).toEqual({ ok: true });
    expect(await getInvoiceRegistration(actor, testDb())).toMatchObject({
      number: "0412-123-00045",
      issuedOn: "2026-09-15",
      seriesStart: 1,
      seriesEnd: 3,
      title: "Service Invoice",
      nextSerial: 1,
      active: true,
    });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "invoice.registration_saved",
      actorId: actor.userId,
      metadata: { after: { number: "0412-123-00045", seriesStart: 1, seriesEnd: 3 } },
    });
  });

  it("needs organization.manage and validates with the business's market", async () => {
    const member = await actorFor("member");
    await expect(save(member)).rejects.toThrow();
    const owner = await actorFor();
    expect(await save(owner, { ...form, seriesEnd: "0" })).toMatchObject({ ok: false, errors: { seriesEnd: expect.any(String) } });
  });

  it("hands out serials in order inside the series, then refuses once it's used up", async () => {
    const actor = await actorFor();
    await save(actor);
    const serials = [await claim(actor), await claim(actor), await claim(actor)];
    expect(serials.map((s) => (s && "serial" in s ? s.serial : null))).toEqual([1, 2, 3]);
    expect(serials[0]).toMatchObject({ number: "0412-123-00045", title: "Service Invoice", seriesStart: 1, seriesEnd: 3 });
    expect(await claim(actor)).toEqual({ exhausted: true, seriesEnd: 3 });
  });

  it("never reuses a serial: a rolled-back issue gives its serial back, a new series can't end before the last one", async () => {
    const actor = await actorFor();
    await save(actor);
    await expect(
      testDb().transaction(async (tx) => {
        await claimRegisteredSerial(tx, actor.organizationId);
        throw new Error("issue failed");
      }),
    ).rejects.toThrow("issue failed");
    expect(await claim(actor)).toMatchObject({ serial: 1 });
    await claim(actor);
    expect(await save(actor, { ...form, seriesEnd: "1" })).toMatchObject({
      ok: false,
      errors: { seriesEnd: "You've already issued serial 2. The series must end at 2 or later." },
    });
    // A new approved series continues from its own first number.
    expect(await save(actor, { ...form, seriesStart: "1001", seriesEnd: "2000" })).toEqual({ ok: true });
    expect(await claim(actor)).toMatchObject({ serial: 1001 });
  });

  it("turning it off keeps the counter, so turning it back on carries on", async () => {
    const actor = await actorFor();
    await save(actor);
    await claim(actor);
    expect(await turnOffInvoiceRegistration(actor, testDb())).toEqual({ ok: true });
    expect(await claim(actor)).toBeNull();
    expect(await getInvoiceRegistration(actor, testDb())).toMatchObject({ active: false, nextSerial: 2 });
    await save(actor);
    expect(await claim(actor)).toMatchObject({ serial: 2 });
    expect((await listAllAuditEvents(testDb())).map((e) => e.action)).toContain("invoice.registration_turned_off");
  });

  it("keeps each business's registration to itself", async () => {
    const one = await actorFor();
    const two = await actorFor();
    await save(one);
    expect(await getInvoiceRegistration(two, testDb())).toBeNull();
    expect(await claim(two)).toBeNull();
  });
});
