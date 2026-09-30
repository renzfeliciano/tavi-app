import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { organizations } from "@/modules/organizations/schema";

// Tax rates a business applies to line items, in basis points (12% = 1200).
// Documents snapshot the name and rate, so editing or archiving a rate never
// changes an issued document (§B.2). Rates are archived, never deleted.
export const taxRates = pgTable(
  "tax_rates",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rateBps: integer("rate_bps").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("tax_rates_organization_id_idx").on(t.organizationId),
    uniqueIndex("tax_rates_active_name_unique")
      .on(t.organizationId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    uniqueIndex("tax_rates_one_default")
      .on(t.organizationId)
      .where(sql`${t.isDefault}`),
    check("tax_rates_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    check("tax_rates_rate_bps_range", sql`${t.rateBps} between 0 and 10000`),
    check("tax_rates_archived_not_default", sql`not (${t.isDefault} and ${t.archivedAt} is not null)`),
  ],
);
