CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"withheld_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) NOT NULL,
	"paid_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"notes" text,
	"receipt_number" text NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_payment_id" text,
	"recorded_by" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "payments_organization_receipt_unique" UNIQUE("organization_id","receipt_number"),
	CONSTRAINT "payments_provider_payment_unique" UNIQUE("provider","provider_payment_id"),
	CONSTRAINT "payments_amounts" CHECK ("payments"."amount_minor" >= 0 and "payments"."withheld_minor" >= 0 and "payments"."amount_minor" + "payments"."withheld_minor" > 0),
	CONSTRAINT "payments_currency_iso" CHECK ("payments"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payments_method" CHECK ("payments"."method" in ('bank_transfer', 'ewallet', 'cash', 'card', 'cheque', 'other')),
	CONSTRAINT "payments_void_reason" CHECK ("payments"."voided_at" is null or "payments"."void_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_organization_paid_on_idx" ON "payments" USING btree ("organization_id","paid_on" DESC NULLS LAST);