import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import { DOCUMENT_EMAIL_LIMIT } from "../domain/document-email-limit";
import { enqueueEmail } from "./outbox";
import { documentEmailsAllowed } from "./document-email-limit";

const message = { to: "customer@example.com", subject: "Quote", text: "Hi" };

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("documentEmailsAllowed", () => {
  it("allows a business's emails up to the hourly limit, counting only its own", async () => {
    const org = await createTestOrganization();
    const other = await createTestOrganization();
    await testDb().transaction(async (tx) => {
      for (let i = 0; i < DOCUMENT_EMAIL_LIMIT.max - 1; i++) await enqueueEmail(tx, message, { organizationId: org.id });
      for (let i = 0; i < 3; i++) await enqueueEmail(tx, message, { organizationId: other.id });
    });
    expect(await documentEmailsAllowed(testDb(), org.id)).toBe(true);

    await testDb().transaction((tx) => enqueueEmail(tx, message, { organizationId: org.id }));
    expect(await documentEmailsAllowed(testDb(), org.id)).toBe(false);
    expect(await documentEmailsAllowed(testDb(), other.id)).toBe(true);
  });

  it("frees up once the window has passed", async () => {
    const org = await createTestOrganization();
    await testDb().transaction(async (tx) => {
      for (let i = 0; i < DOCUMENT_EMAIL_LIMIT.max; i++) await enqueueEmail(tx, message, { organizationId: org.id });
    });
    const later = new Date(Date.now() + (DOCUMENT_EMAIL_LIMIT.windowSeconds + 60) * 1000);
    expect(await documentEmailsAllowed(testDb(), org.id)).toBe(false);
    expect(await documentEmailsAllowed(testDb(), org.id, later)).toBe(true);
  });
});
