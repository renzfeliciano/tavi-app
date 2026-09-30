CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rate_bps" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_rates_name_not_blank" CHECK (length(btrim("tax_rates"."name")) > 0),
	CONSTRAINT "tax_rates_rate_bps_range" CHECK ("tax_rates"."rate_bps" between 0 and 10000),
	CONSTRAINT "tax_rates_archived_not_default" CHECK (not ("tax_rates"."is_default" and "tax_rates"."archived_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" char(64) NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_purpose" CHECK ("files"."purpose" in ('logo')),
	CONSTRAINT "files_content_type" CHECK ("files"."content_type" in ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "files_byte_size" CHECK ("files"."byte_size" between 1 and 1048576),
	CONSTRAINT "files_byte_size_matches" CHECK (octet_length("files"."data") = "files"."byte_size")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "quote_validity_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "payment_terms_days" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_notes" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_terms" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "payment_instructions" text;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tax_rates_organization_id_idx" ON "tax_rates" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rates_active_name_unique" ON "tax_rates" USING btree ("organization_id",lower("name")) WHERE "tax_rates"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rates_one_default" ON "tax_rates" USING btree ("organization_id") WHERE "tax_rates"."is_default";--> statement-breakpoint
CREATE INDEX "files_organization_id_idx" ON "files" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_one_logo_per_organization" ON "files" USING btree ("organization_id") WHERE "files"."purpose" = 'logo';--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_quote_validity_days" CHECK ("organizations"."quote_validity_days" between 1 and 365);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_payment_terms_days" CHECK ("organizations"."payment_terms_days" between 0 and 365);