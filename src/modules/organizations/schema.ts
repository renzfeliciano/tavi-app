import { sql } from "drizzle-orm";
import { char, check, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { ROLES } from "@/modules/authz";

// The tenant. Every tenant-owned row references an organization (§8).
// Business profile columns (legal name, address, tax ID, logo, defaults) are
// added with onboarding in Phase 1.1.
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
