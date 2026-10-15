import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import { getQuestionnaire, saveQuestionnaire } from "./questionnaire";

async function actorFor(role: Role = "owner"): Promise<OrgActor> {
  const organization = await createTestOrganization(testDb());
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: organization.id, userId: user.id, role };
}

const filled = {
  facts: { salesBand: "3m_to_20m", sellsOnline: "yes" },
  questions: {
    registerSystem: { note: "Ask about Tavi", answer: "Register it as a CAS", answeredOn: "2026-10-01" },
    withholding: { note: "Bring the 2307s", answer: "", answeredOn: "" },
  },
};

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

describe("RDO/CPA worksheet", () => {
  it("starts empty for a new business", async () => {
    const actor = await actorFor();
    expect(await getQuestionnaire(actor, testDb())).toEqual({ facts: {}, questions: {}, updatedAt: null });
  });

  it("saves and reads back what was written", async () => {
    const actor = await actorFor();
    const result = await saveQuestionnaire(actor, filled, testDb(), new Date("2026-10-15T01:00:00Z"));
    expect(result.ok && result.changed.sort()).toEqual(["registerSystem", "salesBand", "sellsOnline", "withholding"]);

    expect(await getQuestionnaire(actor, testDb())).toMatchObject({
      facts: { salesBand: "3m_to_20m", sellsOnline: "yes" },
      questions: {
        registerSystem: { note: "Ask about Tavi", answer: "Register it as a CAS", answeredOn: "2026-10-01" },
        withholding: { note: "Bring the 2307s", answer: null, answeredOn: null },
      },
      updatedAt: expect.any(Date),
    });
  });

  it("returns field errors and saves nothing when something is wrong", async () => {
    const actor = await actorFor();
    const result = await saveQuestionnaire(actor, { facts: { salesBand: "a_lot" } }, testDb());
    expect(result).toEqual({ ok: false, errors: { "facts.salesBand": "Choose an option from the list." } });
    expect(await getQuestionnaire(actor, testDb())).toMatchObject({ facts: {} });
  });

  it("uses the business's own date for 'told on'", async () => {
    const actor = await actorFor();
    const now = new Date("2026-10-15T01:00:00Z");
    const tomorrow = { questions: { withholding: { answer: "Yes", answeredOn: "2026-10-17" } } };
    expect(await saveQuestionnaire(actor, tomorrow, testDb(), now)).toMatchObject({
      ok: false,
      errors: { "questions.withholding.answeredOn": "That date is in the future." },
    });
  });

  it("writes no audit row and leaves updatedAt alone when nothing changed", async () => {
    const actor = await actorFor();
    await saveQuestionnaire(actor, filled, testDb());
    const first = await getQuestionnaire(actor, testDb());
    expect(await saveQuestionnaire(actor, filled, testDb())).toMatchObject({ ok: true, changed: [] });
    expect(await listAllAuditEvents(testDb())).toHaveLength(1);
    expect((await getQuestionnaire(actor, testDb())).updatedAt).toEqual(first.updatedAt);
  });

  it("audits the codes that changed and never the text", async () => {
    const actor = await actorFor();
    await saveQuestionnaire(actor, filled, testDb());
    const events = await listAllAuditEvents(testDb());
    expect(events[0]).toMatchObject({ action: "questionnaire.updated", entityType: "questionnaire", entityId: actor.organizationId });
    const json = JSON.stringify(events[0]?.metadata);
    expect(json).toContain("registerSystem");
    expect(json).not.toContain("Register it as a CAS");
    expect(json).not.toContain("Ask about Tavi");
    expect(json).not.toContain("2026-10-01");
  });

  it("returns what is stored, so a date with no answer does not come back", async () => {
    const actor = await actorFor();
    const result = await saveQuestionnaire(
      actor,
      { facts: {}, questions: { withholding: { note: "Ask", answer: "   ", answeredOn: "2026-10-01" } } },
      testDb(),
    );
    expect(result).toMatchObject({
      ok: true,
      value: { facts: {}, questions: { withholding: { note: "Ask", answer: null, answeredOn: null } } },
    });
  });

  it("clears an answer that is sent blank", async () => {
    const actor = await actorFor();
    await saveQuestionnaire(actor, filled, testDb());
    await saveQuestionnaire(actor, { facts: { salesBand: "" }, questions: {} }, testDb());
    expect(await getQuestionnaire(actor, testDb())).toMatchObject({ facts: {}, questions: {} });
  });

  it("keeps each business's worksheet to itself", async () => {
    const a = await actorFor();
    const b = await actorFor();
    await saveQuestionnaire(a, filled, testDb());
    expect(await getQuestionnaire(b, testDb())).toMatchObject({ facts: {}, questions: {}, updatedAt: null });
  });

  it("ignores a stored code the market no longer lists", async () => {
    const actor = await actorFor();
    await saveQuestionnaire(actor, filled, testDb());
    const { sql } = await import("drizzle-orm");
    await testDb().execute(
      sql`update tax_questionnaires set facts = facts || '{"retired":"x"}'::jsonb where organization_id = ${actor.organizationId}`,
    );
    expect((await getQuestionnaire(actor, testDb())).facts).toEqual(filled.facts);
  });

  it("is for owners and admins only", async () => {
    const member = await actorFor("member");
    await expect(getQuestionnaire(member, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveQuestionnaire(member, filled, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    const admin = await actorFor("admin");
    expect(await saveQuestionnaire(admin, filled, testDb())).toMatchObject({ ok: true });
  });
});
