ALTER TABLE "organizations" ALTER COLUMN "default_currency" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "timezone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "locale" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "tax_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "quote_validity_days" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "payment_terms_days" DROP DEFAULT;--> statement-breakpoint
-- Every business so far is in the launch market (PH, D2): backfill, then drop
-- the default so new rows must name their country.
ALTER TABLE "organizations" ADD COLUMN "country_code" char(2) NOT NULL DEFAULT 'PH';--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "country_code" DROP DEFAULT;--> statement-breakpoint
-- "Province" is a Philippine term; the label now comes from the market profile.
ALTER TABLE "organizations" RENAME COLUMN "province" TO "region";--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_iso" CHECK ("organizations"."country_code" ~ '^[A-Z]{2}$');