CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"receipt_number" text NOT NULL,
	"customer_id" uuid,
	"payer_name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"received_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"institution" text,
	"paid_time" text,
	"cheque_date" date,
	"purpose" text NOT NULL,
	"notes" text,
	"seller" jsonb,
	"idempotency_key" text,
	"issued_by" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "receipts_organization_receipt_unique" UNIQUE("organization_id","receipt_number"),
	CONSTRAINT "receipts_organization_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "receipts_kind" CHECK ("receipts"."kind" in ('collection', 'acknowledgement')),
	CONSTRAINT "receipts_amount" CHECK ("receipts"."amount_minor" > 0),
	CONSTRAINT "receipts_currency_iso" CHECK ("receipts"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "receipts_method" CHECK ("receipts"."method" in ('bank_transfer', 'ewallet', 'bank_deposit', 'cash', 'card', 'cheque', 'other')),
	CONSTRAINT "receipts_paid_time" CHECK ("receipts"."paid_time" is null or "receipts"."paid_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "receipts_void_reason" CHECK ("receipts"."voided_at" is null or "receipts"."void_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "public"."customers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_organization_received_on_idx" ON "receipts" USING btree ("organization_id","received_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "receipts_customer_idx" ON "receipts" USING btree ("customer_id");