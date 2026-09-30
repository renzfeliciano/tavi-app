CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"tax_id" text,
	"currency" char(3),
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "customers_display_name_not_blank" CHECK (length(btrim("customers"."display_name")) > 0),
	CONSTRAINT "customers_currency_iso" CHECK ("customers"."currency" is null or "customers"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_organization_name_idx" ON "customers" USING btree ("organization_id",lower("display_name"),"id");