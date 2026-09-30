import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { customers } from "@/modules/customers/schema";
import { users } from "@/modules/identity/schema";
import { organizations } from "@/modules/organizations/schema";
import { QUOTE_STATUSES } from "./domain/status";

/** The customer as they were when the quote was sent (§7). */
export type CustomerSnapshot = {
  displayName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  addressLines: string[];
  taxId: string | null;
};

const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);

// A quote and its lines (§B.3, §C). Totals are stored as calculated by
// calculateDocument when saved, so lists never recompute. Composite foreign
// keys keep every reference inside one business.
export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    /** Assigned at first send; kept by revisions. */
    number: text("number"),
    revision: integer("revision").notNull().default(1),
    status: text("status", { enum: QUOTE_STATUSES }).notNull().default("DRAFT"),
    currency: char("currency", { length: 3 }).notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    validUntil: date("valid_until", { mode: "string" }).notNull(),
    customerSnapshot: jsonb("customer_snapshot").$type<CustomerSnapshot>(),
    notes: text("notes"),
    terms: text("terms"),
    subtotalMinor: money("subtotal_minor"),
    discountTotalMinor: money("discount_total_minor"),
    taxTotalMinor: money("tax_total_minor"),
    totalMinor: money("total_minor"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionName: text("decision_name"),
    decisionNote: text("decision_note"),
    decisionContentHash: text("decision_content_hash"),
    decisionIp: text("decision_ip"),
    decisionUserAgent: text("decision_user_agent"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("quotes_organization_id_id_unique").on(t.organizationId, t.id),
    unique("quotes_organization_number_unique").on(t.organizationId, t.number),
    index("quotes_organization_status_valid_until_idx").on(t.organizationId, t.status, t.validUntil),
    index("quotes_organization_updated_idx").on(t.organizationId, t.updatedAt.desc()),
    foreignKey({
      name: "quotes_customer_fk",
      columns: [t.organizationId, t.customerId],
      foreignColumns: [customers.organizationId, customers.id],
    }),
    check(
      "quotes_status",
      sql`${t.status} in ('DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')`,
    ),
    check("quotes_tax_mode", sql`${t.taxMode} in ('inclusive', 'exclusive')`),
    check("quotes_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("quotes_revision_positive", sql`${t.revision} >= 1`),
    check("quotes_valid_until_after_issue", sql`${t.validUntil} >= ${t.issueDate}`),
    // Once sent, a quote always has its customer and number.
    check(
      "quotes_sent_complete",
      sql`${t.status} in ('DRAFT', 'CANCELLED') or (${t.customerId} is not null and ${t.number} is not null)`,
    ),
    check(
      "quotes_totals_not_negative",
      sql`${t.subtotalMinor} >= 0 and ${t.discountTotalMinor} >= 0 and ${t.taxTotalMinor} >= 0 and ${t.totalMinor} >= 0`,
    ),
  ],
);

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    position: integer("position").notNull(),
    sourceKind: text("source_kind", { enum: ["product", "service"] }),
    sourceId: uuid("source_id"),
    description: text("description").notNull(),
    unitLabel: text("unit_label").notNull(),
    /** Decimal string with 4 places ("1.5000"); scaled ×10 000 in code. */
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    discountKind: text("discount_kind", { enum: ["percent", "amount"] }),
    /** Basis points for percent, minor units for amount. */
    discountValue: bigint("discount_value", { mode: "number" }),
    /** Kept so a draft can reselect the rate; the name and rate are the snapshot. */
    taxRateId: uuid("tax_rate_id"),
    taxRateName: text("tax_rate_name"),
    taxRateBps: integer("tax_rate_bps"),
    grossMinor: bigint("gross_minor", { mode: "number" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("quote_lines_quote_position_unique").on(t.quoteId, t.position),
    foreignKey({
      name: "quote_lines_quote_fk",
      columns: [t.organizationId, t.quoteId],
      foreignColumns: [quotes.organizationId, quotes.id],
    }).onDelete("cascade"),
    check("quote_lines_position_not_negative", sql`${t.position} >= 0`),
    check("quote_lines_quantity_positive", sql`${t.quantity} > 0`),
    check("quote_lines_unit_price_not_negative", sql`${t.unitPriceMinor} >= 0`),
    check("quote_lines_source_kind", sql`${t.sourceKind} is null or ${t.sourceKind} in ('product', 'service')`),
    check(
      "quote_lines_discount_pair",
      sql`(${t.discountKind} is null and ${t.discountValue} is null) or (${t.discountKind} in ('percent', 'amount') and ${t.discountValue} >= 0)`,
    ),
    check(
      "quote_lines_tax_pair",
      sql`(${t.taxRateName} is null and ${t.taxRateBps} is null) or (${t.taxRateName} is not null and ${t.taxRateBps} between 0 and 10000)`,
    ),
    check(
      "quote_lines_amounts_not_negative",
      sql`${t.grossMinor} >= 0 and ${t.discountMinor} >= 0 and ${t.taxMinor} >= 0 and ${t.totalMinor} >= 0`,
    ),
  ],
);
