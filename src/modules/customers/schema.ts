import { sql } from "drizzle-orm";
import { char, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { organizations } from "@/modules/organizations/schema";

// The people and businesses a business bills (§B.1). Archived, never deleted,
// because issued documents reference them; documents keep their own snapshot
// of the customer, so edits never change what was sent.
export const customers = pgTable(
  "customers",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    taxId: text("tax_id"),
    /** Null: bill in the business's currency. */
    currency: char("currency", { length: 3 }),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    // Target for composite foreign keys from quotes and invoices, so a
    // document can't reference another business's customer (§C).
    unique("customers_organization_id_id_unique").on(t.organizationId, t.id),
    index("customers_organization_name_idx").on(t.organizationId, sql`lower(${t.displayName})`, t.id),
    check("customers_display_name_not_blank", sql`length(btrim(${t.displayName})) > 0`),
    check("customers_currency_iso", sql`${t.currency} is null or ${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);
