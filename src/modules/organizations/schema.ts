import { sql } from "drizzle-orm";
import { char, check, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";

// The tenant. Every tenant-owned row references an organization (§8).
// Business profile columns (legal name, address, tax ID, logo, defaults) are
// added with onboarding in Phase 1.1; memberships arrive with users in 0.3.
export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    defaultCurrency: char("default_currency", { length: 3 }).notNull().default("PHP"),
    timezone: text("timezone").notNull().default("Asia/Manila"),
    locale: text("locale").notNull().default("en-PH"),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] })
      .notNull()
      .default("inclusive"),
    ...timestamps(),
  },
  (t) => [
    check("organizations_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    check("organizations_currency_iso", sql`${t.defaultCurrency} ~ '^[A-Z]{3}$'`),
    check("organizations_tax_mode", sql`${t.taxMode} in ('inclusive', 'exclusive')`),
  ],
);
