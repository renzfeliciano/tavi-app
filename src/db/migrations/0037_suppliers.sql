CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"tax_id" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "suppliers_display_name_not_blank" CHECK (length(btrim("suppliers"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suppliers_organization_name_idx" ON "suppliers" USING btree ("organization_id",lower("display_name"),"id");