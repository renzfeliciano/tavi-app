import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import { createShareLink, hashShareToken, resolveShareLink, revokeShareLinks } from "./share-links";

const DOC = "01890000-0000-7000-8000-000000000001";
const future = () => new Date(Date.now() + 86_400_000);

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("share links", () => {
  it("issue a long random token, store only its hash, and resolve it back to the one document", async () => {
    const org = await createTestOrganization();

    const token = await createShareLink(testDb(), {
      organizationId: org.id,
      documentKind: "quote",
      documentId: DOC,
      expiresAt: future(),
      createdBy: null,
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits, base64url
    expect(hashShareToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(await resolveShareLink(testDb(), token)).toEqual({
      organizationId: org.id,
      documentKind: "quote",
      documentId: DOC,
    });
    const { rows } = await testDb().execute<{ token_hash: string }>(
      // The raw token is never stored.
      (await import("drizzle-orm")).sql`select token_hash from share_links`,
    );
    expect(rows.map((r) => r.token_hash)).toEqual([hashShareToken(token)]);
  });

  it("refuse unknown, malformed, revoked and expired tokens", async () => {
    const org = await createTestOrganization();
    const revoked = await createShareLink(testDb(), {
      organizationId: org.id,
      documentKind: "quote",
      documentId: DOC,
      expiresAt: future(),
      createdBy: null,
    });
    await revokeShareLinks(testDb(), { organizationId: org.id, documentKind: "quote", documentId: DOC });
    const expired = await createShareLink(testDb(), {
      organizationId: org.id,
      documentKind: "quote",
      documentId: DOC,
      expiresAt: new Date(Date.now() - 1000),
      createdBy: null,
    });

    for (const token of [revoked, expired, "not-a-real-token-at-all-but-long-enough-xxxxxx", "", "%%%"]) {
      expect(await resolveShareLink(testDb(), token)).toBeNull();
    }
  });

  it("revoke only the named document's links", async () => {
    const org = await createTestOrganization();
    const other = "01890000-0000-7000-8000-000000000002";
    const keep = await createShareLink(testDb(), {
      organizationId: org.id,
      documentKind: "quote",
      documentId: other,
      expiresAt: future(),
      createdBy: null,
    });
    await createShareLink(testDb(), {
      organizationId: org.id,
      documentKind: "quote",
      documentId: DOC,
      expiresAt: future(),
      createdBy: null,
    });

    expect(await revokeShareLinks(testDb(), { organizationId: org.id, documentKind: "quote", documentId: DOC })).toBe(1);
    expect(await resolveShareLink(testDb(), keep)).not.toBeNull();
  });
});
