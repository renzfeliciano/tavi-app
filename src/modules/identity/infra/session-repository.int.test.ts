import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { sessions, users } from "../schema";
import {
  listActiveSessions,
  revokeOtherSessions,
  revokeSessionForUser,
} from "./session-repository";

async function createUserWithSessions(email: string, count: number) {
  const db = testDb();
  const [user] = await db.insert(users).values({ name: "User", email }).returning();
  if (!user) throw new Error("no user");
  const rows = await db
    .insert(sessions)
    .values(
      Array.from({ length: count }, (_, i) => ({
        userId: user.id,
        token: `${email}-token-${i}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        userAgent: `agent-${i}`,
      })),
    )
    .returning();
  return { user, sessions: rows };
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("listActiveSessions", () => {
  it("lists only the user's unexpired sessions, without tokens", async () => {
    const { user } = await createUserWithSessions("maria@example.com", 2);
    await createUserWithSessions("juan@example.com", 1);
    await testDb().insert(sessions).values({
      userId: user.id,
      token: "expired",
      expiresAt: new Date(Date.now() - 1000),
    });

    const list = await listActiveSessions(user.id, testDb());

    expect(list).toHaveLength(2);
    for (const s of list) expect(s).not.toHaveProperty("token");
  });
});

describe("revokeSessionForUser", () => {
  it("signs out one of the user's own devices", async () => {
    const { user, sessions: own } = await createUserWithSessions("maria@example.com", 2);
    const target = own[0]!;

    expect(await revokeSessionForUser(user.id, target.id, testDb())).toBe(true);
    expect((await listActiveSessions(user.id, testDb())).map((s) => s.id)).toEqual([own[1]!.id]);
  });

  it("cannot sign out someone else's session (IDOR)", async () => {
    const maria = await createUserWithSessions("maria@example.com", 1);
    const juan = await createUserWithSessions("juan@example.com", 1);

    expect(await revokeSessionForUser(maria.user.id, juan.sessions[0]!.id, testDb())).toBe(false);
    expect(await listActiveSessions(juan.user.id, testDb())).toHaveLength(1);
  });
});

describe("revokeOtherSessions", () => {
  it("keeps the current session and ends the rest", async () => {
    const { user, sessions: own } = await createUserWithSessions("maria@example.com", 3);
    const other = await createUserWithSessions("juan@example.com", 1);

    const ended = await revokeOtherSessions(user.id, own[0]!.id, testDb());

    expect(ended).toBe(2);
    expect((await listActiveSessions(user.id, testDb())).map((s) => s.id)).toEqual([own[0]!.id]);
    expect(await listActiveSessions(other.user.id, testDb())).toHaveLength(1);
  });
});
