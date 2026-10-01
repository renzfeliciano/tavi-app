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
import { type CustomerSnapshot, quotes } from "@/modules/quotes/schema";
import { INVOICE_STATUSES } from "./domain/status";

const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);

// An invoice and its lines (§B.4, §C): the same shape as a quote, with a due
// date, the payment instructions as issued, and what has been paid. Composite
// foreign keys keep every reference inside one business; `source_quote_id` is
// unique, so converting a quote twice finds the first invoice.
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    sourceQuoteId: uuid("source_quote_id"),
    /** Assigned when issued; kept by edits, void and cancel. */
    number: text("number"),
    revision: integer("revision").notNull().default(1),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("DRAFT"),
    currency: char("currency", { length: 3 }).notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    customerSnapshot: jsonb("customer_snapshot").$type<CustomerSnapshot>(),
    /** The business's payment instructions as they were when issued. */
    paymentInstructions: text("payment_instructions"),
    notes: text("notes"),
    terms: text("terms"),
    subtotalMinor: money("subtotal_minor"),
    discountTotalMinor: money("discount_total_minor"),
    taxTotalMinor: money("tax_total_minor"),
    totalMinor: money("total_minor"),
    /** Sum of active payments (1.8); the status is computed from it. */
    amountPaidMinor: money("amount_paid_minor"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    /** Last edit after sending (D7); the customer's page shows "Updated …". */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("invoices_organization_id_id_unique").on(t.organizationId, t.id),
    unique("invoices_organization_number_unique").on(t.organizationId, t.number),
    unique("invoices_source_quote_unique").on(t.sourceQuoteId),
    index("invoices_organization_status_due_idx").on(t.organizationId, t.status, t.dueDate),
    index("invoices_organization_updated_idx").on(t.organizationId, t.updatedAt.desc()),
    foreignKey({
      name: "invoices_customer_fk",
      columns: [t.organizationId, t.customerId],
      foreignColumns: [customers.organizationId, customers.id],
    }),
    foreignKey({
      name: "invoices_source_quote_fk",
      columns: [t.organizationId, t.sourceQuoteId],
      foreignColumns: [quotes.organizationId, quotes.id],
    }),
    check(
      "invoices_status",
      sql`${t.status} in ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED')`,
    ),
    check("invoices_tax_mode", sql`${t.taxMode} in ('inclusive', 'exclusive')`),
    check("invoices_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("invoices_revision_positive", sql`${t.revision} >= 1`),
    check("invoices_due_after_issue", sql`${t.dueDate} >= ${t.issueDate}`),
    // Once issued, an invoice always has its customer and number.
    check("invoices_issued_complete", sql`${t.status} = 'DRAFT' or (${t.customerId} is not null and ${t.number} is not null)`),
    check(
      "invoices_amounts_not_negative",
      sql`${t.subtotalMinor} >= 0 and ${t.discountTotalMinor} >= 0 and ${t.taxTotalMinor} >= 0 and ${t.totalMinor} >= 0 and ${t.amountPaidMinor} >= 0`,
    ),
    check("invoices_no_overpayment", sql`${t.amountPaidMinor} <= ${t.totalMinor}`),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
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
    unique("invoice_lines_invoice_position_unique").on(t.invoiceId, t.position),
    foreignKey({
      name: "invoice_lines_invoice_fk",
      columns: [t.organizationId, t.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }).onDelete("cascade"),
    check("invoice_lines_position_not_negative", sql`${t.position} >= 0`),
    check("invoice_lines_quantity_positive", sql`${t.quantity} > 0`),
    check("invoice_lines_unit_price_not_negative", sql`${t.unitPriceMinor} >= 0`),
    check("invoice_lines_source_kind", sql`${t.sourceKind} is null or ${t.sourceKind} in ('product', 'service')`),
    check(
      "invoice_lines_discount_pair",
      sql`(${t.discountKind} is null and ${t.discountValue} is null) or (${t.discountKind} in ('percent', 'amount') and ${t.discountValue} >= 0)`,
    ),
    check(
      "invoice_lines_tax_pair",
      sql`(${t.taxRateName} is null and ${t.taxRateBps} is null) or (${t.taxRateName} is not null and ${t.taxRateBps} between 0 and 10000)`,
    ),
    check(
      "invoice_lines_amounts_not_negative",
      sql`${t.grossMinor} >= 0 and ${t.discountMinor} >= 0 and ${t.taxMinor} >= 0 and ${t.totalMinor} >= 0`,
    ),
  ],
);
