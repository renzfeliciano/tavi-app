CREATE TABLE "recurring_schedule_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_schedule_lines_position_unique" UNIQUE("schedule_id","position"),
	CONSTRAINT "recurring_schedule_lines_position_not_negative" CHECK ("recurring_schedule_lines"."position" >= 0),
	CONSTRAINT "recurring_schedule_lines_quantity_positive" CHECK ("recurring_schedule_lines"."quantity" > 0),
	CONSTRAINT "recurring_schedule_lines_tax_snapshot" CHECK (("recurring_schedule_lines"."tax_rate_name" is null and "recurring_schedule_lines"."tax_rate_bps" is null) or ("recurring_schedule_lines"."tax_rate_name" is not null and "recurring_schedule_lines"."tax_rate_bps" between 0 and 10000)),
	CONSTRAINT "recurring_schedule_lines_unit_price_not_negative" CHECK ("recurring_schedule_lines"."unit_price_minor" >= 0),
	CONSTRAINT "recurring_schedule_lines_source_kind" CHECK ("recurring_schedule_lines"."source_kind" is null or "recurring_schedule_lines"."source_kind" in ('product', 'service')),
	CONSTRAINT "recurring_schedule_lines_discount_pair" CHECK (("recurring_schedule_lines"."discount_kind" is null and "recurring_schedule_lines"."discount_value" is null) or ("recurring_schedule_lines"."discount_kind" in ('percent', 'amount') and "recurring_schedule_lines"."discount_value" >= 0))
);
--> statement-breakpoint
CREATE TABLE "recurring_schedules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"source_invoice_id" uuid,
	"frequency" text NOT NULL,
	"anchor_day" smallint NOT NULL,
	"anchor_month" smallint,
	"next_run_on" date NOT NULL,
	"ends_on" date,
	"max_drafts" integer,
	"drafts_created" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"pause_reason" text,
	"terms_days" integer DEFAULT 0 NOT NULL,
	"currency" char(3) NOT NULL,
	"tax_mode" text NOT NULL,
	"notes" text,
	"terms" text,
	"last_run_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_schedules_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "recurring_schedules_frequency" CHECK ("recurring_schedules"."frequency" in ('weekly', 'monthly', 'quarterly', 'yearly')),
	CONSTRAINT "recurring_schedules_status" CHECK ("recurring_schedules"."status" in ('active', 'paused', 'ended')),
	CONSTRAINT "recurring_schedules_anchor_day" CHECK ("recurring_schedules"."anchor_day" between 1 and 31),
	CONSTRAINT "recurring_schedules_anchor_month" CHECK ("recurring_schedules"."anchor_month" is null or "recurring_schedules"."anchor_month" between 1 and 12),
	CONSTRAINT "recurring_schedules_drafts_created" CHECK ("recurring_schedules"."drafts_created" >= 0),
	CONSTRAINT "recurring_schedules_max_drafts" CHECK ("recurring_schedules"."max_drafts" is null or "recurring_schedules"."max_drafts" between 1 and 120),
	CONSTRAINT "recurring_schedules_terms_days" CHECK ("recurring_schedules"."terms_days" >= 0),
	CONSTRAINT "recurring_schedules_currency_iso" CHECK ("recurring_schedules"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "recurring_schedules_tax_mode" CHECK ("recurring_schedules"."tax_mode" in ('inclusive', 'exclusive'))
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recurring_schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "recurring_for_date" date;--> statement-breakpoint
ALTER TABLE "recurring_schedule_lines" ADD CONSTRAINT "recurring_schedule_lines_schedule_fk" FOREIGN KEY ("organization_id","schedule_id") REFERENCES "public"."recurring_schedules"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_source_invoice_id_invoices_id_fk" FOREIGN KEY ("source_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_customer_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "public"."customers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_schedules_due_idx" ON "recurring_schedules" USING btree ("organization_id","status","next_run_on");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_schedule_id_recurring_schedules_id_fk" FOREIGN KEY ("recurring_schedule_id") REFERENCES "public"."recurring_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_run_unique" UNIQUE("recurring_schedule_id","recurring_for_date");