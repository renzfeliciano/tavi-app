import { sql } from "drizzle-orm";
import { char, check, date, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { ROLES } from "@/modules/authz";
import type { PaymentQr } from "./domain/payment-qr";

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
    /** How the business is registered with the tax authority and the body that registered its name (PH: BIR, DTI/SEC/CDA). Codes come from the market profile; the domain validates them. */
    taxpayerType: text("taxpayer_type"),
    incomeTaxOption: text("income_tax_option"),
    taxOfficeCode: text("tax_office_code"),
    taxRegisteredOn: date("tax_registered_on", { mode: "string" }),
    lineOfBusiness: text("line_of_business"),
    industryCode: text("industry_code"),
    nameRegistrationAuthority: text("name_registration_authority"),
    nameRegistrationNumber: text("name_registration_number"),
    nameRegistrationScope: text("name_registration_scope"),
    nameRegistrationValidFrom: date("name_registration_valid_from", { mode: "string" }),
    nameRegistrationValidUntil: date("name_registration_valid_until", { mode: "string" }),
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
    /** Up to three payment QR codes (what a customer scans to pay), printed on quotes and invoices. */
    paymentQrs: jsonb("payment_qrs").$type<PaymentQr[]>().notNull().default(sql`'[]'::jsonb`),
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
    check("organizations_payment_qrs", sql`jsonb_typeof(${t.paymentQrs}) = 'array' and jsonb_array_length(${t.paymentQrs}) <= 3`),
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


// The RDO/CPA worksheet (October 2026): what the owner said about the business
// and wrote down for each question to ask the tax office or an accountant. One
// row per business. It feeds nothing: no setting, document or calculation
// reads it. Codes come from the market profile; the domain validates them.
export const taxQuestionnaires = pgTable(
  "tax_questionnaires",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Fact code → chosen option code. */
    facts: jsonb("facts").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    /** Question code → the owner's note, the answer they were given and the date. */
    questions: jsonb("questions")
      .$type<Record<string, { note: string | null; answer: string | null; answeredOn: string | null }>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    check("tax_questionnaires_facts_object", sql`jsonb_typeof(${t.facts}) = 'object'`),
    check("tax_questionnaires_questions_object", sql`jsonb_typeof(${t.questions}) = 'object'`),
  ],
);
