import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
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
    // Target for composite foreign keys (products and services' default rate).
    unique("tax_rates_organization_id_id_unique").on(t.organizationId, t.id),
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

// Products and services share their shape (D8: two lists, two tables). Only
// products have a SKU. Prices are integer minor units of the item's currency.
// The default tax rate is a composite key, so it can only be one of the same
// business's rates (§C). Items are archived, never deleted: documents keep
// their own snapshot of each line.
const catalogItemColumns = () => ({
  id: id(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  unitLabel: text("unit_label").notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  taxRateId: uuid("tax_rate_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps(),
});

export const products = pgTable(
  "products",
  { ...catalogItemColumns(), sku: text("sku") },
  (t) => [
    unique("products_organization_id_id_unique").on(t.organizationId, t.id),
    index("products_organization_name_idx").on(t.organizationId, sql`lower(${t.name})`, t.id),
    uniqueIndex("products_sku_unique")
      .on(t.organizationId, sql`lower(${t.sku})`)
      .where(sql`${t.sku} is not null`),
    foreignKey({
      name: "products_tax_rate_fk",
      columns: [t.organizationId, t.taxRateId],
      foreignColumns: [taxRates.organizationId, taxRates.id],
    }),
    check("products_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    check("products_unit_label_not_blank", sql`length(btrim(${t.unitLabel})) > 0`),
    check("products_unit_price_not_negative", sql`${t.unitPriceMinor} >= 0`),
    check("products_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const services = pgTable(
  "services",
  catalogItemColumns(),
  (t) => [
    unique("services_organization_id_id_unique").on(t.organizationId, t.id),
    index("services_organization_name_idx").on(t.organizationId, sql`lower(${t.name})`, t.id),
    foreignKey({
      name: "services_tax_rate_fk",
      columns: [t.organizationId, t.taxRateId],
      foreignColumns: [taxRates.organizationId, taxRates.id],
    }),
    check("services_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    check("services_unit_label_not_blank", sql`length(btrim(${t.unitLabel})) > 0`),
    check("services_unit_price_not_negative", sql`${t.unitPriceMinor} >= 0`),
    check("services_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);
