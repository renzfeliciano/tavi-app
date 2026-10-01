import { sql } from "drizzle-orm";
import { bigint, char, check, date, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { PAYMENT_METHODS } from "@/config/markets";
import { id, timestamps } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { invoices } from "@/modules/invoices/schema";
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
    reference: text("reference"),
    notes: text("notes"),
    /** The payment acknowledgement's number, from the receipt series. */
    receiptNumber: text("receipt_number").notNull(),
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
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_organization_paid_on_idx").on(t.organizationId, t.paidOn.desc()),
    foreignKey({
      name: "payments_invoice_fk",
      columns: [t.organizationId, t.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }),
    check("payments_amounts", sql`${t.amountMinor} >= 0 and ${t.withheldMinor} >= 0 and ${t.amountMinor} + ${t.withheldMinor} > 0`),
    check("payments_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("payments_method", sql`${t.method} in ('bank_transfer', 'ewallet', 'cash', 'card', 'cheque', 'other')`),
    check("payments_void_reason", sql`${t.voidedAt} is null or ${t.voidReason} is not null`),
  ],
);
