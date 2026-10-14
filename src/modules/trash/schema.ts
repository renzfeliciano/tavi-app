import { sql } from "drizzle-orm";
import { bigint, char, check, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { id } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { organizations } from "@/modules/organizations/schema";
import { TRASH_KINDS } from "./domain/trash";

// The recycle bin (D27): a deleted draft, sent quotation, voided payment or voided 2307, kept whole for a while.
// The draft's own rows are removed as before, so no list, report or number
// sequence ever sees it; `payload` holds what restoring needs, and `customer_name`
// and the total are what the bin page shows. `expires_at` is
// when the daily job removes the row for good.
export const trashItems = pgTable(
  "trash_items",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: TRASH_KINDS }).notNull(),
    /** The deleted draft's id: restoring brings it back under the same one. */
    originalId: uuid("original_id").notNull(),
    customerName: text("customer_name"),
    /** The number the record carried (quotation or receipt number, or who and which quarter for a 2307), so the bin can name it. */
    label: text("label"),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    payload: jsonb("payload").notNull(),
    deletedBy: uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("trash_items_organization_id_id_unique").on(t.organizationId, t.id),
    unique("trash_items_organization_original_unique").on(t.organizationId, t.kind, t.originalId),
    index("trash_items_organization_deleted_idx").on(t.organizationId, t.deletedAt.desc()),
    index("trash_items_expires_idx").on(t.expiresAt),
    check("trash_items_kind", sql`${t.kind} in ('invoice', 'quote', 'sent_quote', 'payment', 'certificate')`),
    check("trash_items_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("trash_items_total_not_negative", sql`${t.totalMinor} >= 0`),
    check("trash_items_expires_after_deleted", sql`${t.expiresAt} > ${t.deletedAt}`),
  ],
);
