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
import { users } from "@/modules/identity/schema";
import type { SellerSnapshot } from "@/modules/organizations";
import { organizations } from "@/modules/organizations/schema";
import { PO_STATUSES } from "./domain/status";

// The businesses and people a business buys from. Archived, never deleted,
// because purchase orders reference them; an issued order keeps its own
// snapshot of the supplier, so edits never change what was sent.
export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    taxId: text("tax_id"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    // Target for the composite foreign key from purchase orders, so an order
    // can't reference another business's supplier.
    unique("suppliers_organization_id_id_unique").on(t.organizationId, t.id),
    index("suppliers_organization_name_idx").on(t.organizationId, sql`lower(${t.displayName})`, t.id),
    check("suppliers_display_name_not_blank", sql`length(btrim(${t.displayName})) > 0`),
  ],
);

/** The supplier as they were when the order was issued. */
export type SupplierSnapshot = {
  displayName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLines: string[];
  taxId: string | null;
};

const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);

// A purchase order and its lines. Totals are stored as calculated by
// calculateDocument when saved, so lists never recompute. Composite foreign
// keys keep every reference inside one business.
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id"),
    /** Assigned at issue. */
    number: text("number"),
    status: text("status", { enum: PO_STATUSES }).notNull().default("DRAFT"),
    currency: char("currency", { length: 3 }).notNull(),
    taxMode: text("tax_mode", { enum: ["inclusive", "exclusive"] }).notNull(),
    orderDate: date("order_date", { mode: "string" }).notNull(),
    expectedDate: date("expected_date", { mode: "string" }),
    supplierSnapshot: jsonb("supplier_snapshot").$type<SupplierSnapshot>(),
    /** The business as it was when the order was issued (D25); null on drafts. */
    sellerSnapshot: jsonb("seller_snapshot").$type<SellerSnapshot>(),
    notes: text("notes"),
    terms: text("terms"),
    subtotalMinor: money("subtotal_minor"),
    discountTotalMinor: money("discount_total_minor"),
    taxTotalMinor: money("tax_total_minor"),
    totalMinor: money("total_minor"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    receivedDate: date("received_date", { mode: "string" }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receiptNote: text("receipt_note"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("purchase_orders_organization_id_id_unique").on(t.organizationId, t.id),
    unique("purchase_orders_organization_number_unique").on(t.organizationId, t.number),
    index("purchase_orders_organization_status_idx").on(t.organizationId, t.status, t.orderDate.desc()),
    index("purchase_orders_organization_updated_idx").on(t.organizationId, t.updatedAt.desc()),
    foreignKey({
      name: "purchase_orders_supplier_fk",
      columns: [t.organizationId, t.supplierId],
      foreignColumns: [suppliers.organizationId, suppliers.id],
    }),
    check("purchase_orders_status", sql`${t.status} in ('DRAFT', 'ISSUED', 'RECEIVED', 'CANCELLED')`),
    check("purchase_orders_tax_mode", sql`${t.taxMode} in ('inclusive', 'exclusive')`),
    check("purchase_orders_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("purchase_orders_expected_after_order", sql`${t.expectedDate} is null or ${t.expectedDate} >= ${t.orderDate}`),
    // Once issued, an order always has its supplier and number.
    check(
      "purchase_orders_issued_complete",
      sql`${t.status} = 'DRAFT' or (${t.supplierId} is not null and ${t.number} is not null)`,
    ),
    check("purchase_orders_received_date", sql`(${t.status} = 'RECEIVED') = (${t.receivedDate} is not null)`),
    check(
      "purchase_orders_totals_not_negative",
      sql`${t.subtotalMinor} >= 0 and ${t.discountTotalMinor} >= 0 and ${t.taxTotalMinor} >= 0 and ${t.totalMinor} >= 0`,
    ),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    position: integer("position").notNull(),
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
    unique("purchase_order_lines_order_position_unique").on(t.purchaseOrderId, t.position),
    foreignKey({
      name: "purchase_order_lines_order_fk",
      columns: [t.organizationId, t.purchaseOrderId],
      foreignColumns: [purchaseOrders.organizationId, purchaseOrders.id],
    }).onDelete("cascade"),
    check("purchase_order_lines_position_not_negative", sql`${t.position} >= 0`),
    check("purchase_order_lines_quantity_positive", sql`${t.quantity} > 0`),
    check("purchase_order_lines_unit_price_not_negative", sql`${t.unitPriceMinor} >= 0`),
    check(
      "purchase_order_lines_discount_pair",
      sql`(${t.discountKind} is null and ${t.discountValue} is null) or (${t.discountKind} in ('percent', 'amount') and ${t.discountValue} >= 0)`,
    ),
    check(
      "purchase_order_lines_tax_pair",
      sql`(${t.taxRateName} is null and ${t.taxRateBps} is null) or (${t.taxRateName} is not null and ${t.taxRateBps} between 0 and 10000)`,
    ),
    check(
      "purchase_order_lines_amounts_not_negative",
      sql`${t.grossMinor} >= 0 and ${t.discountMinor} >= 0 and ${t.taxMinor} >= 0 and ${t.totalMinor} >= 0`,
    ),
  ],
);
