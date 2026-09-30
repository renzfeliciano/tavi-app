import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import type { EmailMessage, EmailSender } from "../domain/email";
import { createMemorySender } from "../infra/senders";
import { outboxMessages } from "../schema";
import { dispatchOutbox, enqueueEmail } from "./outbox";

const message: EmailMessage = {
  to: "customer@example.com",
  subject: "Quote QUO-000001 from Acme",
  text: "View your quote: https://app.tavi.example/q/secret-token",
};

const failing = (error = "provider down"): EmailSender => ({
  async send() {
    throw new Error(error);
  },
});

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("enqueueEmail", () => {
  it("stores the email in the caller's transaction and rolls back with it", async () => {
    await expect(
      testDb().transaction(async (tx) => {
        await enqueueEmail(tx, message);
        throw new Error("quote send failed");
      }),
    ).rejects.toThrow();
    expect(await testDb().select().from(outboxMessages)).toHaveLength(0);

    const org = await createTestOrganization();
    await testDb().transaction((tx) => enqueueEmail(tx, message, { organizationId: org.id }));
    const [row] = await testDb().select().from(outboxMessages);
    expect(row).toMatchObject({ status: "pending", attempts: 0, organizationId: org.id });
  });
});

describe("dispatchOutbox", () => {
  it("delivers due emails, then keeps only the recipient and subject", async () => {
    await enqueueEmail(testDb(), message);
    const mail = createMemorySender();

    const result = await dispatchOutbox({ db: testDb(), sender: mail.sender });

    expect(result).toEqual({ sent: 1, retrying: 0, failed: 0 });
    expect(mail.sent).toEqual([message]);
    const [row] = await testDb().select().from(outboxMessages);
    expect(row).toMatchObject({ status: "sent", attempts: 1, lastError: null });
    expect(row?.sentAt).toBeInstanceOf(Date);
    expect(row?.payload).toEqual({ to: message.to, subject: message.subject });
  });

  it("schedules a retry with backoff when sending fails", async () => {
    await enqueueEmail(testDb(), message);
    const now = new Date();

    const result = await dispatchOutbox({ db: testDb(), sender: failing(), now: () => now });

    expect(result).toEqual({ sent: 0, retrying: 1, failed: 0 });
    const [row] = await testDb().select().from(outboxMessages);
    expect(row).toMatchObject({ status: "pending", attempts: 1, lastError: "provider down" });
    expect(row!.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);

    // Not due yet: a second run right away sends nothing.
    const mail = createMemorySender();
    expect(await dispatchOutbox({ db: testDb(), sender: mail.sender, now: () => now })).toEqual({
      sent: 0,
      retrying: 0,
      failed: 0,
    });
  });

  it("gives up after the last attempt and marks the message failed", async () => {
    await enqueueEmail(testDb(), message);
    await testDb().update(outboxMessages).set({ attempts: 5 });

    const result = await dispatchOutbox({ db: testDb(), sender: failing() });

    expect(result).toEqual({ sent: 0, retrying: 0, failed: 1 });
    const [row] = await testDb().select().from(outboxMessages);
    expect(row).toMatchObject({ status: "failed", attempts: 6 });
  });

  it("never sends the same email twice when dispatchers overlap", async () => {
    for (let i = 0; i < 5; i++) await enqueueEmail(testDb(), { ...message, subject: `Email ${i}` });
    const mail = createMemorySender();
    const slow: EmailSender = {
      async send(m) {
        await new Promise((r) => setTimeout(r, 50));
        await mail.sender.send(m);
      },
    };

    const [a, b] = await Promise.all([
      dispatchOutbox({ db: testDb(), sender: slow }),
      dispatchOutbox({ db: testDb(), sender: slow }),
    ]);

    expect(a.sent + b.sent).toBe(5);
    expect(mail.sent.map((m) => m.subject).sort()).toEqual(
      ["Email 0", "Email 1", "Email 2", "Email 3", "Email 4"],
    );
  });

  it("never records provider error details that contain credentials", async () => {
    await enqueueEmail(testDb(), message);
    await dispatchOutbox({
      db: testDb(),
      sender: failing("POST https://user:hunter2@api.example.com failed"),
    });
    const [row] = await testDb().select().from(outboxMessages);
    expect(row?.lastError).not.toContain("hunter2");
  });
});
