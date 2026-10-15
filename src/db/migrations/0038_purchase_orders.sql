CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"unit_label" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"discount_kind" text,
	"discount_value" bigint,
	"tax_rate_id" uuid,
	"tax_rate_name" text,
	"tax_rate_bps" integer,
	"gross_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_lines_order_position_unique" UNIQUE("purchase_order_id","position"),
	CONSTRAINT "purchase_order_lines_position_not_negative" CHECK ("purchase_order_lines"."position" >= 0),
	CONSTRAINT "purchase_order_lines_quantity_positive" CHECK ("purchase_order_lines"."quantity" > 0),
	CONSTRAINT "purchase_order_lines_unit_price_not_negative" CHECK ("purchase_order_lines"."unit_price_minor" >= 0),
	CONSTRAINT "purchase_order_lines_discount_pair" CHECK (("purchase_order_lines"."discount_kind" is null and "purchase_order_lines"."discount_value" is null) or ("purchase_order_lines"."discount_kind" in ('percent', 'amount') and "purchase_order_lines"."discount_value" >= 0)),
	CONSTRAINT "purchase_order_lines_tax_pair" CHECK (("purchase_order_lines"."tax_rate_name" is null and "purchase_order_lines"."tax_rate_bps" is null) or ("purchase_order_lines"."tax_rate_name" is not null and "purchase_order_lines"."tax_rate_bps" between 0 and 10000)),
	CONSTRAINT "purchase_order_lines_amounts_not_negative" CHECK ("purchase_order_lines"."gross_minor" >= 0 and "purchase_order_lines"."discount_minor" >= 0 and "purchase_order_lines"."tax_minor" >= 0 and "purchase_order_lines"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid,
	"number" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency" char(3) NOT NULL,
	"tax_mode" text NOT NULL,
	"order_date" date NOT NULL,
	"expected_date" date,
	"supplier_snapshot" jsonb,
	"seller_snapshot" jsonb,
	"notes" text,
	"terms" text,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"discount_total_minor" bigint DEFAULT 0 NOT NULL,
	"tax_total_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone,
	"received_date" date,
	"received_at" timestamp with time zone,
	"receipt_note" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "purchase_orders_organization_number_unique" UNIQUE("organization_id","number"),
	CONSTRAINT "purchase_orders_status" CHECK ("purchase_orders"."status" in ('DRAFT', 'ISSUED', 'RECEIVED', 'CANCELLED')),
	CONSTRAINT "purchase_orders_tax_mode" CHECK ("purchase_orders"."tax_mode" in ('inclusive', 'exclusive')),
	CONSTRAINT "purchase_orders_currency_iso" CHECK ("purchase_orders"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "purchase_orders_expected_after_order" CHECK ("purchase_orders"."expected_date" is null or "purchase_orders"."expected_date" >= "purchase_orders"."order_date"),
	CONSTRAINT "purchase_orders_issued_complete" CHECK ("purchase_orders"."status" = 'DRAFT' or ("purchase_orders"."supplier_id" is not null and "purchase_orders"."number" is not null)),
	CONSTRAINT "purchase_orders_received_date" CHECK (("purchase_orders"."status" = 'RECEIVED') = ("purchase_orders"."received_date" is not null)),
	CONSTRAINT "purchase_orders_totals_not_negative" CHECK ("purchase_orders"."subtotal_minor" >= 0 and "purchase_orders"."discount_total_minor" >= 0 and "purchase_orders"."tax_total_minor" >= 0 and "purchase_orders"."total_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_order_fk" FOREIGN KEY ("organization_id","purchase_order_id") REFERENCES "public"."purchase_orders"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_orders_organization_status_idx" ON "purchase_orders" USING btree ("organization_id","status","order_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "purchase_orders_organization_updated_idx" ON "purchase_orders" USING btree ("organization_id","updated_at" DESC NULLS LAST);