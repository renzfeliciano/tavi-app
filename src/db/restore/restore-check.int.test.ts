import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import { compareSnapshots, takeSnapshot } from "./restore-check";

const client = {
  query: async <R,>(text: string) => ({ rows: (await testDb().execute(sql.raw(text))).rows as R[] }),
};

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("restore check", () => {
  it("matches an unchanged database and catches a lost or altered row", async () => {
    const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
    const before = await takeSnapshot(client);
    expect(before.tables.organizations).toMatchObject({ rows: 1 });
    expect(compareSnapshots(before, await takeSnapshot(client))).toEqual([]);

    await testDb().execute(sql`update organizations set name = 'Santos Aircon Services' where id = ${org.id}`);
    expect(compareSnapshots(before, await takeSnapshot(client))).toEqual([
      "organizations: same row count (1) but different rows",
    ]);

    await createTestOrganization(testDb());
    expect(compareSnapshots(before, await takeSnapshot(client))).toContain("organizations: 1 rows before, 2 restored");
  });
});
