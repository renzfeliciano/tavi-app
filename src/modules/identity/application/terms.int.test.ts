import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { LEGAL } from "@/config/legal";
import { closeTestDb, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { users } from "../schema";
import { acceptTerms } from "./terms";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("acceptTerms", () => {
  it("records the current version, the server's time and an audit event", async () => {
    const user = await createTestUser(testDb(), { termsVersion: "2020-01-01" });

    expect(await acceptTerms(user.id, LEGAL.version, testDb())).toEqual({ ok: true });

    const [row] = await testDb().select().from(users).where(eq(users.id, user.id));
    expect(row?.termsVersion).toBe(LEGAL.version);
    expect(row?.termsAcceptedAt).toBeInstanceOf(Date);
    expect(await listAllAuditEvents()).toMatchObject([
      { action: "auth.terms_accepted", actorId: user.id, metadata: { termsVersion: LEGAL.version } },
    ]);
  });

  it("refuses any version but the current one, changing nothing", async () => {
    const user = await createTestUser(testDb(), { termsVersion: "2020-01-01" });

    expect(await acceptTerms(user.id, "2020-01-01", testDb())).toEqual({ ok: false, error: "stale_version" });
    expect(await acceptTerms(user.id, undefined, testDb())).toEqual({ ok: false, error: "stale_version" });

    const [row] = await testDb().select().from(users).where(eq(users.id, user.id));
    expect(row?.termsVersion).toBe("2020-01-01");
    expect(await listAllAuditEvents()).toEqual([]);
  });
});
