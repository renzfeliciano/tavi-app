import { sql } from "drizzle-orm";
import { bigint, check, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "@/db/columns";
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
