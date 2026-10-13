import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { DOCUMENT_EMAIL_LIMIT, GLOBAL_EMAIL_LIMIT, PERSON_EMAIL_LIMIT } from "../domain/document-email-limit";
import { enqueueEmail } from "./outbox";
import { emailLimitReached } from "./document-email-limit";

const message = { to: "customer@example.com", subject: "Quote", text: "Hi" };

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

async function queue(count: number, organizationId: string, actorUserId: string | null = null) {
  await testDb().transaction(async (tx) => {
    for (let i = 0; i < count; i++) await enqueueEmail(tx, message, { organizationId, actorUserId });
  });
}

const person = (n: number) => createTestUser(testDb(), { email: `person${n}@example.com` });

describe("emailLimitReached: one business", () => {
  it("allows a business's emails up to the hourly limit, counting only its own", async () => {
    const org = await createTestOrganization();
    const other = await createTestOrganization();
    const user = await person(1);
    await queue(DOCUMENT_EMAIL_LIMIT.max - 1, org.id, user.id);
    await queue(3, other.id);
    expect(await emailLimitReached(testDb(), { organizationId: org.id, userId: user.id })).toBeNull();

    await queue(1, org.id, user.id);
    expect(await emailLimitReached(testDb(), { organizationId: org.id, userId: user.id })).toBe("business");
    expect(await emailLimitReached(testDb(), { organizationId: other.id, userId: user.id })).toBeNull();
  });

  it("frees up once the window has passed", async () => {
    const org = await createTestOrganization();
    const user = await person(1);
    await queue(DOCUMENT_EMAIL_LIMIT.max, org.id, user.id);
    const later = new Date(Date.now() + (DOCUMENT_EMAIL_LIMIT.windowSeconds + 60) * 1000);
    const scope = { organizationId: org.id, userId: user.id };
    expect(await emailLimitReached(testDb(), scope)).toBe("business");
    expect(await emailLimitReached(testDb(), scope, later)).toBeNull();
  });

  it("counts the emails a command is about to queue", async () => {
    const org = await createTestOrganization();
    const user = await person(1);
    await queue(DOCUMENT_EMAIL_LIMIT.max - 2, org.id, user.id);
    const scope = { organizationId: org.id, userId: user.id };
    expect(await emailLimitReached(testDb(), scope, new Date(), 2)).toBeNull();
    expect(await emailLimitReached(testDb(), scope, new Date(), 3)).toBe("business");
  });
});

describe("emailLimitReached: one person, several businesses", () => {
  it("stops a person from multiplying the business cap by opening more businesses", async () => {
    const [a, b, c] = [await createTestOrganization(), await createTestOrganization(), await createTestOrganization()];
    const user = await person(1);
    const half = PERSON_EMAIL_LIMIT.max / 2;
    await queue(half, a!.id, user.id);
    await queue(half, b!.id, user.id);

    // The third business has sent nothing, so its own cap is far away.
    expect(await emailLimitReached(testDb(), { organizationId: c!.id, userId: user.id })).toBe("person");
  });

  it("counts only that person's emails, not a teammate's in the same business", async () => {
    const org = await createTestOrganization();
    const [maria, juan] = [await person(1), await person(2)];
    await queue(DOCUMENT_EMAIL_LIMIT.max - 1, org.id, juan.id);
    const other = await createTestOrganization();
    await queue(PERSON_EMAIL_LIMIT.max - 1, other.id, maria.id);

    // Maria is one email under her own cap, and the business is one under its cap.
    expect(await emailLimitReached(testDb(), { organizationId: org.id, userId: maria.id })).toBeNull();
  });

  it("reports the business cap first when both are reached", async () => {
    const org = await createTestOrganization();
    const user = await person(1);
    await queue(DOCUMENT_EMAIL_LIMIT.max, org.id, user.id);
    const second = await createTestOrganization();
    await queue(PERSON_EMAIL_LIMIT.max - DOCUMENT_EMAIL_LIMIT.max, second.id, user.id);
    expect(await emailLimitReached(testDb(), { organizationId: org.id, userId: user.id })).toBe("business");
  });
});

describe("emailLimitReached: everyone together", () => {
  it("stops all sending when Tavi as a whole has queued too much, whoever asks", async () => {
    // Four businesses, each under its own cap, with no one person near theirs.
    const orgs = await Promise.all([1, 2, 3, 4].map(() => createTestOrganization()));
    const each = Math.ceil(GLOBAL_EMAIL_LIMIT.max / orgs.length);
    expect(each).toBeLessThan(DOCUMENT_EMAIL_LIMIT.max);
    for (const org of orgs) await queue(each, org.id);

    const newcomer = await createTestOrganization();
    const user = await person(1);
    expect(await emailLimitReached(testDb(), { organizationId: newcomer.id, userId: user.id })).toBe("global");
  });

  it("lets sending resume once the window has passed", async () => {
    const orgs = await Promise.all([1, 2, 3, 4].map(() => createTestOrganization()));
    for (const org of orgs) await queue(Math.ceil(GLOBAL_EMAIL_LIMIT.max / orgs.length), org.id);
    const user = await person(1);
    const later = new Date(Date.now() + (GLOBAL_EMAIL_LIMIT.windowSeconds + 60) * 1000);
    const scope = { organizationId: orgs[0]!.id, userId: user.id };
    expect(await emailLimitReached(testDb(), scope, later)).toBeNull();
  });
});
