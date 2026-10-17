import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import { allocateDocumentNumber } from "../infra/sequences";
import { getDocumentNumbering, updateDocumentNumbering } from "./numbering";

async function actorFor(role: Role = "owner", name = "Acme"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("getDocumentNumbering", () => {
  it("shows the defaults and the next number before anything is issued", async () => {
    const actor = await actorFor("member");

    expect(await getDocumentNumbering(actor, testDb())).toEqual([
      { kind: "quote", prefix: "QUO-", padding: 6, nextValue: 1, nextNumber: "QUO-000001" },
      { kind: "invoice", prefix: "INV-", padding: 6, nextValue: 1, nextNumber: "INV-000001" },
      { kind: "receipt", prefix: "REC-", padding: 6, nextValue: 1, nextNumber: "REC-000001" },
    ]);
  });

  it("reflects numbers already issued", async () => {
    const actor = await actorFor();
    await allocateDocumentNumber(testDb(), actor.organizationId, "invoice");
    await allocateDocumentNumber(testDb(), actor.organizationId, "invoice");

    const invoice = (await getDocumentNumbering(actor, testDb())).find((n) => n.kind === "invoice");

    expect(invoice?.nextNumber).toBe("INV-000003");
  });
});

describe("updateDocumentNumbering", () => {
  it("changes the format of future numbers, starting from 1 if none were issued", async () => {
    const actor = await actorFor();

    const result = await updateDocumentNumbering(actor, "quote", { prefix: "acme-q-", padding: "4" }, testDb());

    expect(result).toEqual({ ok: true });
    expect(await allocateDocumentNumber(testDb(), actor.organizationId, "quote")).toEqual({
      value: 1,
      number: "ACME-Q-0001",
    });
    expect(await listAllAuditEvents(testDb())).toEqual([
      expect.objectContaining({
        action: "numbering.updated",
        organizationId: actor.organizationId,
        entityType: "document_sequence",
        metadata: {
          kind: "quote",
          before: { prefix: "QUO-", padding: 6 },
          after: { prefix: "ACME-Q-", padding: 4 },
        },
      }),
    ]);
  });

  it("never resets or reuses the sequence", async () => {
    const actor = await actorFor();
    await allocateDocumentNumber(testDb(), actor.organizationId, "invoice");
    await allocateDocumentNumber(testDb(), actor.organizationId, "invoice");

    await updateDocumentNumbering(actor, "invoice", { prefix: "SI-", padding: "3" }, testDb());

    expect((await allocateDocumentNumber(testDb(), actor.organizationId, "invoice")).number).toBe("SI-003");
  });

  it("returns field errors for invalid input", async () => {
    const actor = await actorFor();

    expect(await updateDocumentNumbering(actor, "quote", { prefix: "Q 1", padding: "2" }, testDb())).toEqual({
      ok: false,
      fieldErrors: {
        prefix: ["Use up to 12 letters, digits or dashes."],
        padding: ["Choose between 3 and 10 digits."],
      },
    });
  });

  it("refuses members", async () => {
    const actor = await actorFor("member");

    await expect(
      updateDocumentNumbering(actor, "quote", { prefix: "Q-", padding: "4" }, testDb()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("only changes the actor's organization", async () => {
    const actor = await actorFor("owner", "One");
    const other = await actorFor("owner", "Two");

    await updateDocumentNumbering(actor, "quote", { prefix: "ONE-", padding: "4" }, testDb());

    expect((await getDocumentNumbering(other, testDb()))[0]?.nextNumber).toBe("QUO-000001");
  });
});
