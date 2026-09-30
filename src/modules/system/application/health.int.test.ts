import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { enqueueEmail } from "@/modules/notifications";
import { checkReadiness } from "./health";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("checkReadiness", () => {
  it("reports a reachable database and an empty outbox", async () => {
    expect(await checkReadiness(testDb())).toEqual({
      ok: true,
      database: "ok",
      outbox: { pending: 0, failed: 0, oldestPendingSeconds: 0 },
    });
  });

  it("reports the outbox backlog for monitoring", async () => {
    await enqueueEmail(testDb(), { to: "a@example.com", subject: "s", text: "t" });
    const result = await checkReadiness(testDb());
    expect(result.outbox.pending).toBe(1);
    expect(result.outbox.oldestPendingSeconds).toBeGreaterThanOrEqual(0);
  });
});
