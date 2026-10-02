import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { shareLinks } from "../schema";

export type ShareableKind = "quote" | "invoice";
export type SharedDocument = { organizationId: string; documentKind: ShareableKind; documentId: string };

const TOKEN_BYTES = 32; // 256 bits
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Opens a link to one document and returns its token. This is the only time
 * the token exists outside the customer's hands: only its hash is stored.
 */
export async function createShareLink(
  executor: Executor,
  link: SharedDocument & { expiresAt: Date; createdBy: string | null },
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  await executor.insert(shareLinks).values({ ...link, tokenHash: hashShareToken(token) });
  return token;
}

/** Closes every open link to a document (revise, cancel); returns how many. */
export async function revokeShareLinks(executor: Executor, document: SharedDocument): Promise<number> {
  const rows = await executor
    .update(shareLinks)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(shareLinks.organizationId, document.organizationId),
        eq(shareLinks.documentKind, document.documentKind),
        eq(shareLinks.documentId, document.documentId),
        isNull(shareLinks.revokedAt),
      ),
    )
    .returning({ id: shareLinks.id });
  return rows.length;
}

/** Moves the end date of every open link to a document (e.g. 90 days after an invoice is paid). */
export async function setShareLinksExpiry(executor: Executor, document: SharedDocument, expiresAt: Date): Promise<void> {
  await executor
    .update(shareLinks)
    .set({ expiresAt })
    .where(
      and(
        eq(shareLinks.organizationId, document.organizationId),
        eq(shareLinks.documentKind, document.documentKind),
        eq(shareLinks.documentId, document.documentId),
        isNull(shareLinks.revokedAt),
      ),
    );
}

/** The document a token opens, or null if it's unknown, revoked or expired. */
export async function resolveShareLink(executor: Executor, token: string): Promise<SharedDocument | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [row] = await executor
    .select({
      organizationId: shareLinks.organizationId,
      documentKind: shareLinks.documentKind,
      documentId: shareLinks.documentId,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.tokenHash, hashShareToken(token)),
        isNull(shareLinks.revokedAt),
        gt(shareLinks.expiresAt, sql`now()`),
      ),
    );
  return row ?? null;
}

/** Counts an open of the link; true the first time it's opened. */
export async function recordShareLinkView(executor: Executor, token: string): Promise<boolean> {
  const [row] = await executor
    .update(shareLinks)
    .set({
      firstViewedAt: sql`coalesce(${shareLinks.firstViewedAt}, now())`,
      lastViewedAt: sql`now()`,
      viewCount: sql`${shareLinks.viewCount} + 1`,
    })
    .where(eq(shareLinks.tokenHash, hashShareToken(token)))
    .returning({ viewCount: shareLinks.viewCount });
  return row?.viewCount === 1;
}

/** Closes every open customer link of a business (it was closed); returns how many. */
export async function revokeOrganizationShareLinks(executor: Executor, organizationId: string): Promise<number> {
  const rows = await executor
    .update(shareLinks)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(shareLinks.organizationId, organizationId), isNull(shareLinks.revokedAt)))
    .returning({ id: shareLinks.id });
  return rows.length;
}
