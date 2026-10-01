CREATE TABLE "invoice_registrations" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"issued_on" date NOT NULL,
	"series_start" bigint NOT NULL,
	"series_end" bigint NOT NULL,
	"next_serial" bigint NOT NULL,
	"title" text NOT NULL,
	"turned_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_registrations_series" CHECK ("invoice_registrations"."series_start" >= 1 and "invoice_registrations"."series_end" >= "invoice_registrations"."series_start"),
	CONSTRAINT "invoice_registrations_next_serial" CHECK ("invoice_registrations"."next_serial" between "invoice_registrations"."series_start" and "invoice_registrations"."series_end" + 1)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "registration" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_registrations" ADD CONSTRAINT "invoice_registrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;