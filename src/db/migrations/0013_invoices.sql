CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"source_kind" text,
	"source_id" uuid,
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
	CONSTRAINT "invoice_lines_invoice_position_unique" UNIQUE("invoice_id","position"),
	CONSTRAINT "invoice_lines_position_not_negative" CHECK ("invoice_lines"."position" >= 0),
	CONSTRAINT "invoice_lines_quantity_positive" CHECK ("invoice_lines"."quantity" > 0),
	CONSTRAINT "invoice_lines_unit_price_not_negative" CHECK ("invoice_lines"."unit_price_minor" >= 0),
	CONSTRAINT "invoice_lines_source_kind" CHECK ("invoice_lines"."source_kind" is null or "invoice_lines"."source_kind" in ('product', 'service')),
	CONSTRAINT "invoice_lines_discount_pair" CHECK (("invoice_lines"."discount_kind" is null and "invoice_lines"."discount_value" is null) or ("invoice_lines"."discount_kind" in ('percent', 'amount') and "invoice_lines"."discount_value" >= 0)),
	CONSTRAINT "invoice_lines_tax_pair" CHECK (("invoice_lines"."tax_rate_name" is null and "invoice_lines"."tax_rate_bps" is null) or ("invoice_lines"."tax_rate_name" is not null and "invoice_lines"."tax_rate_bps" between 0 and 10000)),
	CONSTRAINT "invoice_lines_amounts_not_negative" CHECK ("invoice_lines"."gross_minor" >= 0 and "invoice_lines"."discount_minor" >= 0 and "invoice_lines"."tax_minor" >= 0 and "invoice_lines"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid,
	"source_quote_id" uuid,
	"number" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency" char(3) NOT NULL,
	"tax_mode" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"customer_snapshot" jsonb,
	"payment_instructions" text,
	"notes" text,
	"terms" text,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"discount_total_minor" bigint DEFAULT 0 NOT NULL,
	"tax_total_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"amount_paid_minor" bigint DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "invoices_organization_number_unique" UNIQUE("organization_id","number"),
	CONSTRAINT "invoices_source_quote_unique" UNIQUE("source_quote_id"),
	CONSTRAINT "invoices_status" CHECK ("invoices"."status" in ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED')),
	CONSTRAINT "invoices_tax_mode" CHECK ("invoices"."tax_mode" in ('inclusive', 'exclusive')),
	CONSTRAINT "invoices_currency_iso" CHECK ("invoices"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "invoices_revision_positive" CHECK ("invoices"."revision" >= 1),
	CONSTRAINT "invoices_due_after_issue" CHECK ("invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "invoices_issued_complete" CHECK ("invoices"."status" = 'DRAFT' or ("invoices"."customer_id" is not null and "invoices"."number" is not null)),
	CONSTRAINT "invoices_amounts_not_negative" CHECK ("invoices"."subtotal_minor" >= 0 and "invoices"."discount_total_minor" >= 0 and "invoices"."tax_total_minor" >= 0 and "invoices"."total_minor" >= 0 and "invoices"."amount_paid_minor" >= 0),
	CONSTRAINT "invoices_no_overpayment" CHECK ("invoices"."amount_paid_minor" <= "invoices"."total_minor")
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "converted_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "public"."customers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_quote_fk" FOREIGN KEY ("organization_id","source_quote_id") REFERENCES "public"."quotes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_organization_status_due_idx" ON "invoices" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE INDEX "invoices_organization_updated_idx" ON "invoices" USING btree ("organization_id","updated_at" DESC NULLS LAST);