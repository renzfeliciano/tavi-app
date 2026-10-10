import { sql } from "drizzle-orm";
import { char, check, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    /** What kind of work the business does: a code from config/categories (D21); null until chosen. */
    category: text("category"),
    timezone: text("timezone").notNull(),
    locale: text("locale").notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    /** A market tax registration code (PH: vat, non_vat, non_vat_exempt); null until set (D13). */
    taxRegistration: text("tax_registration"),
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
    // Set when its only member closes their account: the records stay (tax
    // rules), its customer links close and daily jobs skip it.
    closedAt: timestamp("closed_at", { withTimezone: true }),
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

// Invitations to join a business (Phase 2.1, D17). Like customer links, only
// the SHA-256 of the token is stored. At most one open invitation per email
// per business; accepting, cancelling or expiring frees the address.
export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Lowercased, as Better Auth stores account emails. */
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("invitations_organization_idx").on(t.organizationId, t.createdAt),
    uniqueIndex("invitations_open_email_unique")
      .on(t.organizationId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
    check("invitations_role", sql`${t.role} in ('admin', 'member')`),
    check("invitations_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

