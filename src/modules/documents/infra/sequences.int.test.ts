import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  resetTables,
  testDb,
} from "@/db/testing";
import { documentSequences } from "../schema";
import { allocateDocumentNumber } from "./sequences";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("allocateDocumentNumber", () => {
  it("starts at 1 and counts up in the default format", async () => {
    const org = await createTestOrganization();
    const db = testDb();

    const first = await allocateDocumentNumber(db, org.id, "quote");
    const second = await allocateDocumentNumber(db, org.id, "quote");
    const third = await allocateDocumentNumber(db, org.id, "quote");

    expect([first, second, third]).toEqual([
      { value: 1, number: "QUO-000001" },
      { value: 2, number: "QUO-000002" },
      { value: 3, number: "QUO-000003" },
    ]);
  });

  it("keeps separate sequences per document kind", async () => {
    const org = await createTestOrganization();
    const db = testDb();

    await allocateDocumentNumber(db, org.id, "quote");
    await allocateDocumentNumber(db, org.id, "quote");

    expect(await allocateDocumentNumber(db, org.id, "invoice")).toEqual({
      value: 1,
      number: "INV-000001",
    });
    expect(await allocateDocumentNumber(db, org.id, "receipt")).toEqual({
      value: 1,
      number: "REC-000001",
    });
  });

  it("keeps separate sequences per organization", async () => {
    const acme = await createTestOrganization(testDb(), { name: "Acme" });
    const bravo = await createTestOrganization(testDb(), { name: "Bravo" });
    const db = testDb();

    await allocateDocumentNumber(db, acme.id, "invoice");
    await allocateDocumentNumber(db, acme.id, "invoice");

    expect((await allocateDocumentNumber(db, bravo.id, "invoice")).value).toBe(1);
  });

  it("hands out unique, consecutive numbers under concurrency", async () => {
    const org = await createTestOrganization();
    const db = testDb();

    const allocations = await Promise.all(
      Array.from({ length: 50 }, () =>
        db.transaction((tx) => allocateDocumentNumber(tx, org.id, "invoice")),
      ),
    );

    const values = allocations.map((a) => a.value).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("never burns a number when the issuing transaction rolls back", async () => {
    const org = await createTestOrganization();
    const db = testDb();

    await expect(
      db.transaction(async (tx) => {
        await allocateDocumentNumber(tx, org.id, "quote");
        throw new Error("issuing failed after numbering");
      }),
    ).rejects.toThrow("issuing failed");

    expect((await allocateDocumentNumber(db, org.id, "quote")).number).toBe(
      "QUO-000001",
    );
  });

  it("keeps an organization's custom prefix and padding", async () => {
    const org = await createTestOrganization();
    const db = testDb();
    await db.insert(documentSequences).values({
      organizationId: org.id,
      kind: "invoice",
      prefix: "ACME-",
      padding: 4,
      nextValue: 120,
    });

    expect(await allocateDocumentNumber(db, org.id, "invoice")).toEqual({
      value: 120,
      number: "ACME-0120",
    });
  });

  it("refuses to number documents for an organization that doesn't exist", async () => {
    await expect(
      allocateDocumentNumber(testDb(), "0199a000-0000-7000-8000-000000000000", "quote"),
    ).rejects.toMatchObject({ cause: { code: "23503" } }); // foreign_key_violation
  });
});
