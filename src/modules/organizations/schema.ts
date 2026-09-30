import { sql } from "drizzle-orm";
import { char, check, index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { ROLES } from "@/modules/authz";

// The tenant. Every tenant-owned row references an organization (§8).
// It also holds the business profile printed on documents and the defaults new
// quotes and invoices start from (Phase 1.1). The logo lives in the files
// module (purpose 'logo'), so this table has no reference to it.
export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    // No column defaults for market-specific values: new businesses take them
    // from their market profile (src/config/markets.ts).
    countryCode: char("country_code", { length: 2 }).notNull(),
    defaultCurrency: char("default_currency", { length: 3 }).notNull(),
    timezone: text("timezone").notNull(),
    locale: text("locale").notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    quoteValidityDays: integer("quote_validity_days").notNull(),
    paymentTermsDays: integer("payment_terms_days").notNull(),
    defaultNotes: text("default_notes"),
    defaultTerms: text("default_terms"),
    paymentInstructions: text("payment_instructions"),
    ...timestamps(),
  },
  (t) => [
    check("organizations_name_not_blank", sql`length(btrim(${t.name})) > 0`),
    check("organizations_country_iso", sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
    check("organizations_currency_iso", sql`${t.defaultCurrency} ~ '^[A-Z]{3}$'`),
    check("organizations_tax_mode", sql`${t.taxMode} in ('inclusive', 'exclusive')`),
    check("organizations_quote_validity_days", sql`${t.quoteValidityDays} between 1 and 365`),
    check("organizations_payment_terms_days", sql`${t.paymentTermsDays} between 0 and 365`),
  ],
);

// Who belongs to which organization, and with which role (§E).
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("memberships_organization_user_unique").on(t.organizationId, t.userId),
    index("memberships_user_id_idx").on(t.userId),
    check("memberships_role", sql`${t.role} in ('owner', 'admin', 'member')`),
  ],
);
