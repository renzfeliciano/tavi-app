import { sql } from "drizzle-orm";
import { bigint, char, check, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { organizations } from "@/modules/organizations/schema";
import { DOCUMENT_KINDS } from "./domain/numbering";

// Per-organization, per-kind counters for gapless document numbers (§B.6).
// Allocation increments `next_value` inside the issuing transaction; the row
// lock serializes concurrent issuers and a rollback un-does the increment.
export const documentSequences = pgTable(
  "document_sequences",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DOCUMENT_KINDS }).notNull(),
    prefix: text("prefix").notNull(),
    nextValue: bigint("next_value", { mode: "number" }).notNull().default(1),
    padding: integer("padding").notNull().default(6),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.kind] }),
    check("document_sequences_kind", sql`${t.kind} in ('quote', 'invoice', 'receipt')`),
    check("document_sequences_next_value_positive", sql`${t.nextValue} >= 1`),
    check("document_sequences_padding_range", sql`${t.padding} between 1 and 12`),
    check("document_sequences_prefix_length", sql`char_length(${t.prefix}) <= 12`),
  ],
);

// Public links to one document each (§I). Only the SHA-256 of the token is
// stored, so a database leak exposes no live link. Links are revoked (never
// deleted) and expire.
export const shareLinks = pgTable(
  "share_links",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentKind: text("document_kind", { enum: ["quote", "invoice"] }).notNull(),
    documentId: uuid("document_id").notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull().unique("share_links_token_hash_unique"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("share_links_document_idx").on(t.organizationId, t.documentKind, t.documentId),
    check("share_links_document_kind", sql`${t.documentKind} in ('quote', 'invoice')`),
    check("share_links_token_hash_hex", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
);
