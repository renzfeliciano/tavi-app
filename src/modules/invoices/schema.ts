import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { customers } from "@/modules/customers/schema";
import { users } from "@/modules/identity/schema";
import type { SellerSnapshot } from "@/modules/organizations";
import { organizations } from "@/modules/organizations/schema";
import { type CustomerSnapshot, quotes } from "@/modules/quotes/schema";
import type { QualifiedDiscountSnapshot } from "./domain/qualified-discount";
import type { InvoiceRegistrationSnapshot } from "./domain/registration";
import { INVOICE_STATUSES } from "./domain/status";
import { RECURRENCE_FREQUENCIES } from "./domain/recurrence";

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
    /** The recurring schedule that made this draft and the due date it was made for (spec 4); null for every other bill. */
    recurringScheduleId: uuid("recurring_schedule_id").references((): AnyPgColumn => recurringSchedules.id, { onDelete: "set null" }),
    recurringForDate: date("recurring_for_date", { mode: "string" }),
    /** Assigned when issued; kept by edits, void and cancel. */
    number: text("number"),
    revision: integer("revision").notNull().default(1),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("DRAFT"),
    currency: char("currency", { length: 3 }).notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    customerSnapshot: jsonb("customer_snapshot").$type<CustomerSnapshot>(),
    /** The business's name, tax ID, registration, contact and address as issued (D25); null on drafts. */
    sellerSnapshot: jsonb("seller_snapshot").$type<SellerSnapshot>(),
    /** The business's payment instructions as they were when issued. */
    paymentInstructions: text("payment_instructions"),
    notes: text("notes"),
    terms: text("terms"),
    subtotalMinor: money("subtotal_minor"),
    discountTotalMinor: money("discount_total_minor"),
    taxTotalMinor: money("tax_total_minor"),
    totalMinor: money("total_minor"),
    /**
     * A qualified buyer's discount (D19; PH: senior citizen, PWD, …, RR 7-2024
     * Sec. 6 B.18): the kind with its rate and tax treatment as applied, the
     * buyer's ID number and name. Null when there's none.
     */
    qualifiedDiscount: jsonb("qualified_discount").$type<QualifiedDiscountSnapshot>(),
    qualifiedDiscountMinor: money("qualified_discount_minor"),
    /** Tax the sale would have carried, waived by a tax-exempt qualified discount. */
    taxWaivedMinor: money("tax_waived_minor"),
    /** Sum of active payments (1.8); the status is computed from it. */
    amountPaidMinor: money("amount_paid_minor"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    /**
     * Set when issued as a registered invoice (invoice mode, 1.12): the
     * registration as printed and the serial. Null for billing statements.
     * A registered invoice can't be edited once issued (D14).
     */
    registration: jsonb("registration").$type<InvoiceRegistrationSnapshot>(),
    /**
     * PDFs made of an issued registered invoice (D19, RR 7-2024 Sec. 6 B.21):
     * the first is the original, every later one prints "REPRINT".
     */
    printCount: integer("print_count").notNull().default(0),
    firstPrintedAt: timestamp("first_printed_at", { withTimezone: true }),
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
    // Reports find a period's bills by issue date (D18).
    index("invoices_organization_issue_date_idx").on(t.organizationId, t.issueDate),
    // One draft per schedule per due date: the daily job can run twice and never make a second one.
    unique("invoices_recurring_run_unique").on(t.recurringScheduleId, t.recurringForDate),
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
      sql`${t.subtotalMinor} >= 0 and ${t.discountTotalMinor} >= 0 and ${t.taxTotalMinor} >= 0 and ${t.totalMinor} >= 0 and ${t.amountPaidMinor} >= 0 and ${t.qualifiedDiscountMinor} >= 0 and ${t.taxWaivedMinor} >= 0`,
    ),
    check("invoices_no_overpayment", sql`${t.amountPaidMinor} <= ${t.totalMinor}`),
    check("invoices_print_count_not_negative", sql`${t.printCount} >= 0`),
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
    /** This line's share of the bill's qualified discount, and the tax it waived (D19). */
    qualifiedDiscountMinor: bigint("qualified_discount_minor", { mode: "number" }).notNull().default(0),
    taxWaivedMinor: bigint("tax_waived_minor", { mode: "number" }).notNull().default(0),
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
      sql`${t.grossMinor} >= 0 and ${t.discountMinor} >= 0 and ${t.taxMinor} >= 0 and ${t.totalMinor} >= 0 and ${t.qualifiedDiscountMinor} >= 0 and ${t.taxWaivedMinor} >= 0`,
    ),
  ],
);

// A business's registered invoicing system (invoice mode, D13, 1.12): the
// certificate, its approved serial range and the next serial to issue. One
// row per business; turning invoice mode off keeps the row (and the counter),
// so serials are never reissued. The counter moves inside the issuing
// transaction, under a row lock, so serials stay gapless like §B.6 numbers.
export const invoiceRegistrations = pgTable(
  "invoice_registrations",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    issuedOn: date("issued_on", { mode: "string" }).notNull(),
    seriesStart: bigint("series_start", { mode: "number" }).notNull(),
    seriesEnd: bigint("series_end", { mode: "number" }).notNull(),
    /** The serial the next registered invoice gets; seriesEnd + 1 when the series is used up. */
    nextSerial: bigint("next_serial", { mode: "number" }).notNull(),
    title: text("title").notNull(),
    /** Invoice mode is on while this is null. */
    turnedOffAt: timestamp("turned_off_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check("invoice_registrations_series", sql`${t.seriesStart} >= 1 and ${t.seriesEnd} >= ${t.seriesStart}`),
    check("invoice_registrations_next_serial", sql`${t.nextSerial} between ${t.seriesStart} and ${t.seriesEnd} + 1`),
  ],
);

// A bill that repeats (spec 4): when it comes due, the daily job makes one draft from these lines and terms.
// The schedule keeps its own copy, so changing or deleting the bill it was made from changes nothing here.
export const SCHEDULE_STATUSES = ["active", "paused", "ended"] as const;

export const recurringSchedules = pgTable(
  "recurring_schedules",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull(),
    /** The bill it was made from, for display only; cleared if that bill is ever removed. */
    sourceInvoiceId: uuid("source_invoice_id").references(
      (): AnyPgColumn => invoices.id,
      { onDelete: "set null" },
    ),
    frequency: text("frequency", { enum: RECURRENCE_FREQUENCIES }).notNull(),
    /** Day of the month (1-31), or the weekday (1-7, Monday = 1) for weekly. */
    anchorDay: smallint("anchor_day").notNull(),
    /** 1-12 for yearly, else null. */
    anchorMonth: smallint("anchor_month"),
    /** The next due date, a calendar day in the business's time zone. */
    nextRunOn: date("next_run_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    maxDrafts: integer("max_drafts"),
    draftsCreated: integer("drafts_created").notNull().default(0),
    status: text("status", { enum: SCHEDULE_STATUSES })
      .notNull()
      .default("active"),
    /** Why Tavi paused it itself (customer gone, tax rate gone); null when a person paused it. */
    pauseReason: text("pause_reason"),
    /** Days from a draft's issue date to its due date, kept from the bill it was made from. */
    termsDays: integer("terms_days").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    notes: text("notes"),
    terms: text("terms"),
    lastRunOn: date("last_run_on", { mode: "string" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    unique("recurring_schedules_organization_id_id_unique").on(
      t.organizationId,
      t.id,
    ),
    index("recurring_schedules_due_idx").on(
      t.organizationId,
      t.status,
      t.nextRunOn,
    ),
    foreignKey({
      name: "recurring_schedules_customer_fk",
      columns: [t.organizationId, t.customerId],
      foreignColumns: [customers.organizationId, customers.id],
    }),
    check(
      "recurring_schedules_frequency",
      sql`${t.frequency} in ('weekly', 'monthly', 'quarterly', 'yearly')`,
    ),
    check(
      "recurring_schedules_status",
      sql`${t.status} in ('active', 'paused', 'ended')`,
    ),
    check(
      "recurring_schedules_anchor_day",
      sql`${t.anchorDay} between 1 and 31`,
    ),
    check(
      "recurring_schedules_anchor_month",
      sql`${t.anchorMonth} is null or ${t.anchorMonth} between 1 and 12`,
    ),
    check("recurring_schedules_drafts_created", sql`${t.draftsCreated} >= 0`),
    check(
      "recurring_schedules_max_drafts",
      sql`${t.maxDrafts} is null or ${t.maxDrafts} between 1 and 120`,
    ),
    check("recurring_schedules_terms_days", sql`${t.termsDays} >= 0`),
    check(
      "recurring_schedules_currency_iso",
      sql`${t.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "recurring_schedules_tax_mode",
      sql`${t.taxMode} in ('inclusive', 'exclusive')`,
    ),
  ],
);

/** A schedule's lines: what a draft will hold, before any calculation. Amounts are worked out when the draft is made. */
export const recurringScheduleLines = pgTable(
  "recurring_schedule_lines",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    scheduleId: uuid("schedule_id").notNull(),
    position: integer("position").notNull(),
    sourceKind: text("source_kind", { enum: ["product", "service"] }),
    sourceId: uuid("source_id"),
    description: text("description").notNull(),
    unitLabel: text("unit_label").notNull(),
    /** Decimal string with 4 places ("1.5000"). */
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    discountKind: text("discount_kind", { enum: ["percent", "amount"] }),
    discountValue: bigint("discount_value", { mode: "number" }),
    taxRateId: uuid("tax_rate_id"),
    /** The rate as it was when the schedule was made; later drafts use this, not the catalog's current rate. */
    taxRateName: text("tax_rate_name"),
    taxRateBps: integer("tax_rate_bps"),
    ...timestamps(),
  },
  (t) => [
    unique("recurring_schedule_lines_position_unique").on(
      t.scheduleId,
      t.position,
    ),
    foreignKey({
      name: "recurring_schedule_lines_schedule_fk",
      columns: [t.organizationId, t.scheduleId],
      foreignColumns: [
        recurringSchedules.organizationId,
        recurringSchedules.id,
      ],
    }).onDelete("cascade"),
    check(
      "recurring_schedule_lines_position_not_negative",
      sql`${t.position} >= 0`,
    ),
    check("recurring_schedule_lines_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "recurring_schedule_lines_tax_snapshot",
      sql`(${t.taxRateName} is null and ${t.taxRateBps} is null) or (${t.taxRateName} is not null and ${t.taxRateBps} between 0 and 10000)`,
    ),
    check(
      "recurring_schedule_lines_unit_price_not_negative",
      sql`${t.unitPriceMinor} >= 0`,
    ),
    check(
      "recurring_schedule_lines_source_kind",
      sql`${t.sourceKind} is null or ${t.sourceKind} in ('product', 'service')`,
    ),
    check(
      "recurring_schedule_lines_discount_pair",
      sql`(${t.discountKind} is null and ${t.discountValue} is null) or (${t.discountKind} in ('percent', 'amount') and ${t.discountValue} >= 0)`,
    ),
  ],
);
