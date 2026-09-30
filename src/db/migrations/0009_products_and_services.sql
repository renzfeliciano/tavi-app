-- The composite foreign keys below need this target first.
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_organization_id_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_label" text NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"tax_rate_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sku" text,
	CONSTRAINT "products_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "products_name_not_blank" CHECK (length(btrim("products"."name")) > 0),
	CONSTRAINT "products_unit_label_not_blank" CHECK (length(btrim("products"."unit_label")) > 0),
	CONSTRAINT "products_unit_price_not_negative" CHECK ("products"."unit_price_minor" >= 0),
	CONSTRAINT "products_currency_iso" CHECK ("products"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_label" text NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"tax_rate_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "services_name_not_blank" CHECK (length(btrim("services"."name")) > 0),
	CONSTRAINT "services_unit_label_not_blank" CHECK (length(btrim("services"."unit_label")) > 0),
	CONSTRAINT "services_unit_price_not_negative" CHECK ("services"."unit_price_minor" >= 0),
	CONSTRAINT "services_currency_iso" CHECK ("services"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rate_fk" FOREIGN KEY ("organization_id","tax_rate_id") REFERENCES "public"."tax_rates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tax_rate_fk" FOREIGN KEY ("organization_id","tax_rate_id") REFERENCES "public"."tax_rates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_organization_name_idx" ON "products" USING btree ("organization_id",lower("name"),"id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("organization_id",lower("sku")) WHERE "products"."sku" is not null;--> statement-breakpoint
CREATE INDEX "services_organization_name_idx" ON "services" USING btree ("organization_id",lower("name"),"id");
