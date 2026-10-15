import { sql } from "drizzle-orm";
import { bigint, char, check, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { PAYMENT_METHODS, RECEIPT_KINDS } from "@/config/markets";
import { id, timestamps } from "@/db/columns";
import { customers } from "@/modules/customers/schema";
import { files } from "@/modules/files/schema";
import { users } from "@/modules/identity/schema";
import { invoices } from "@/modules/invoices/schema";
import type { SellerSnapshot } from "@/modules/organizations";
import { organizations } from "@/modules/organizations/schema";

// Payments against an invoice (§B.5, §C). Never deleted: a mistaken payment
// is voided with a reason. `amount_minor` is money received; `withheld_minor`
// is tax the customer withheld and remits for the business (PH: Form 2307).
// Both settle the balance, so the invoice's paid amount is their sum over
// active payments. `provider` / `provider_payment_id` let a payment gateway
// record through the same use case later.
export const payments = pgTable(
  "payments",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    withheldMinor: bigint("withheld_minor", { mode: "number" }).notNull().default(0),
    currency: char("currency", { length: 3 }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull(),
    /** Proof of payment, as the business typed it (never checked against a bank). */
    reference: text("reference"),
    /** The bank or wallet it went through. */
    institution: text("institution"),
    /** Who paid, as shown on the transfer or cheque. */
    payerName: text("payer_name"),
    /** The time it was paid, "HH:MM" (the day is `paid_on`). */
    paidTime: text("paid_time"),
    /** A cheque's own date; can be post-dated. */
    chequeDate: date("cheque_date", { mode: "string" }),
    notes: text("notes"),
    /** The payment acknowledgement's number, from the receipt series. */
    receiptNumber: text("receipt_number").notNull(),
    /** The attempt's idempotency key: a repeat of the same request finds this payment (§B.5). */
    idempotencyKey: text("idempotency_key"),
    provider: text("provider").notNull().default("manual"),
    providerPaymentId: text("provider_payment_id"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("payments_organization_id_id_unique").on(t.organizationId, t.id),
    unique("payments_organization_receipt_unique").on(t.organizationId, t.receiptNumber),
    unique("payments_provider_payment_unique").on(t.provider, t.providerPaymentId),
    unique("payments_organization_idempotency_unique").on(t.organizationId, t.idempotencyKey),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_organization_paid_on_idx").on(t.organizationId, t.paidOn.desc()),
    foreignKey({
      name: "payments_invoice_fk",
      columns: [t.organizationId, t.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }),
    check("payments_amounts", sql`${t.amountMinor} >= 0 and ${t.withheldMinor} >= 0 and ${t.amountMinor} + ${t.withheldMinor} > 0`),
    check("payments_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("payments_method", sql`${t.method} in ('bank_transfer', 'ewallet', 'bank_deposit', 'cash', 'card', 'cheque', 'other')`),
    check("payments_paid_time", sql`${t.paidTime} is null or ${t.paidTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check("payments_void_reason", sql`${t.voidedAt} is null or ${t.voidReason} is not null`),
  ],
);

// Receipts for money that is not an invoice payment (a reimbursement, a deposit, an advance), design:
// docs/superpowers/specs/2026-10-15-receipts-design.md. Issued at once with the next number from the receipt
// series (the one payment acknowledgements use) and never deleted: a mistake is voided with a reason. They are
// not payments: no invoice, no balance, no sales figure. `payer_name` is the name as printed, also when a
// customer is chosen; `seller` freezes the business's details at issue (D25).
export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: RECEIPT_KINDS }).notNull(),
    receiptNumber: text("receipt_number").notNull(),
    customerId: uuid("customer_id"),
    payerName: text("payer_name").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull(),
    reference: text("reference"),
    institution: text("institution"),
    /** The time received, "HH:MM" (the day is `received_on`). */
    paidTime: text("paid_time"),
    /** A cheque's own date; can be post-dated. */
    chequeDate: date("cheque_date", { mode: "string" }),
    /** What the money is for ("Reimbursement of fuel"). */
    purpose: text("purpose").notNull(),
    notes: text("notes"),
    seller: jsonb("seller").$type<SellerSnapshot>(),
    /** The attempt's idempotency key: a repeat of the same request finds this receipt. */
    idempotencyKey: text("idempotency_key"),
    issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("receipts_organization_id_id_unique").on(t.organizationId, t.id),
    unique("receipts_organization_receipt_unique").on(t.organizationId, t.receiptNumber),
    unique("receipts_organization_idempotency_unique").on(t.organizationId, t.idempotencyKey),
    index("receipts_organization_received_on_idx").on(t.organizationId, t.receivedOn.desc()),
    index("receipts_customer_idx").on(t.customerId),
    foreignKey({
      name: "receipts_customer_fk",
      columns: [t.organizationId, t.customerId],
      foreignColumns: [customers.organizationId, customers.id],
    }),
    check("receipts_kind", sql`${t.kind} in ('collection', 'acknowledgement')`),
    check("receipts_amount", sql`${t.amountMinor} > 0`),
    check("receipts_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("receipts_method", sql`${t.method} in ('bank_transfer', 'ewallet', 'bank_deposit', 'cash', 'card', 'cheque', 'other')`),
    check("receipts_paid_time", sql`${t.paidTime} is null or ${t.paidTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check("receipts_void_reason", sql`${t.voidedAt} is null or ${t.voidReason} is not null`),
  ],
);

// Withholding-tax certificates (PH: BIR Form 2307), design:
// docs/superpowers/specs/2026-10-13-withholding-certificates-design.md.
// A customer withholds tax when it pays and sends the certificate later. A
// certificate is a snapshot of the form (payor as written on it, rows with
// their ATC and rate as data), optionally with its scan, linked to the
// payments it covers. Never deleted: a mistaken one is voided with a reason.
// "2307 pending" is not stored: it is a payment with `withheld_minor > 0`
// and no link.
export const withholdingCertificates = pgTable(
  "withholding_certificates",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** The payor: the customer who withheld the tax. */
    customerId: uuid("customer_id").notNull(),
    /** As written on the form. */
    payorTin: text("payor_tin").notNull(),
    payorName: text("payor_name").notNull(),
    payorAddress: text("payor_address"),
    periodFrom: date("period_from", { mode: "string" }).notNull(),
    periodTo: date("period_to", { mode: "string" }).notNull(),
    /** When the certificate arrived. */
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    /** Must equal the linked payments' currency. */
    currency: char("currency", { length: 3 }).notNull(),
    /** The scan, kept in the files store. */
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("withholding_certificates_organization_id_id_unique").on(t.organizationId, t.id),
    index("withholding_certificates_period_idx").on(t.organizationId, t.periodFrom.desc()),
    index("withholding_certificates_customer_idx").on(t.customerId),
    foreignKey({
      name: "withholding_certificates_customer_fk",
      columns: [t.organizationId, t.customerId],
      foreignColumns: [customers.organizationId, customers.id],
    }),
    check("withholding_certificates_period", sql`${t.periodFrom} <= ${t.periodTo}`),
    // The form's three month columns assume one calendar quarter.
    check(
      "withholding_certificates_one_quarter",
      sql`date_trunc('quarter', ${t.periodFrom}::timestamp) = date_trunc('quarter', ${t.periodTo}::timestamp)`,
    ),
    check("withholding_certificates_void_reason", sql`${t.voidedAt} is null or ${t.voidReason} is not null`),
    check("withholding_certificates_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

// One row of the form's table: the income payments for an ATC across the
// quarter's three months, and the tax withheld as printed.
export const withholdingCertificateLines = pgTable(
  "withholding_certificate_lines",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    certificateId: uuid("certificate_id").notNull(),
    position: smallint("position").notNull(),
    atcCode: text("atc_code").notNull(),
    /** The nature of the income payment, as written on the form. */
    description: text("description"),
    /** The rate in basis points (200 is 2.00%). Data, never hard-coded. */
    rateBps: integer("rate_bps").notNull(),
    month1Minor: bigint("month1_minor", { mode: "number" }).notNull(),
    month2Minor: bigint("month2_minor", { mode: "number" }).notNull(),
    month3Minor: bigint("month3_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    /** As printed: the person can type what the form says, so it can differ from rate × total by a centavo. */
    taxWithheldMinor: bigint("tax_withheld_minor", { mode: "number" }).notNull(),
  },
  (t) => [
    unique("withholding_lines_position_unique").on(t.certificateId, t.position),
    foreignKey({
      name: "withholding_lines_certificate_fk",
      columns: [t.organizationId, t.certificateId],
      foreignColumns: [withholdingCertificates.organizationId, withholdingCertificates.id],
    }).onDelete("cascade"),
    check("withholding_lines_position", sql`${t.position} between 1 and 5`),
    check("withholding_lines_atc", sql`${t.atcCode} ~ '^[A-Z0-9]{1,10}$'`),
    check("withholding_lines_rate", sql`${t.rateBps} between 1 and 10000`),
    check("withholding_lines_months", sql`${t.month1Minor} >= 0 and ${t.month2Minor} >= 0 and ${t.month3Minor} >= 0`),
    check("withholding_lines_total", sql`${t.totalMinor} = ${t.month1Minor} + ${t.month2Minor} + ${t.month3Minor} and ${t.totalMinor} > 0`),
    check("withholding_lines_tax", sql`${t.taxWithheldMinor} > 0 and ${t.taxWithheldMinor} <= ${t.totalMinor}`),
  ],
);

// The payments a certificate covers. A payment sits under at most one
// certificate; voiding the certificate deletes its links (audited), so the
// payments are pending again. Billing statements are reached through payments.
export const withholdingCertificatePayments = pgTable(
  "withholding_certificate_payments",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    certificateId: uuid("certificate_id").notNull(),
    paymentId: uuid("payment_id").notNull(),
  },
  (t) => [
    primaryKey({ name: "withholding_certificate_payments_pk", columns: [t.certificateId, t.paymentId] }),
    unique("withholding_certificate_payments_payment_unique").on(t.paymentId),
    foreignKey({
      name: "withholding_certificate_payments_certificate_fk",
      columns: [t.organizationId, t.certificateId],
      foreignColumns: [withholdingCertificates.organizationId, withholdingCertificates.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "withholding_certificate_payments_payment_fk",
      columns: [t.organizationId, t.paymentId],
      foreignColumns: [payments.organizationId, payments.id],
    }),
  ],
);
