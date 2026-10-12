ALTER TABLE "quotes" ADD COLUMN "seller_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "seller_snapshot" jsonb;--> statement-breakpoint
-- D25 backfill: documents already issued keep the business details as they are today
-- (there is one live profile per business, so freezing it now is the closest the record can be to what was sent).
UPDATE "invoices" SET "seller_snapshot" = jsonb_build_object(
  'name', o."name", 'legalName', o."legal_name", 'taxId', o."tax_id", 'taxRegistration', o."tax_registration",
  'email', o."email", 'phone', o."phone", 'addressLine1', o."address_line1", 'addressLine2', o."address_line2",
  'city', o."city", 'region', o."region", 'postalCode', o."postal_code")
FROM "organizations" o
WHERE "invoices"."organization_id" = o."id" AND "invoices"."status" <> 'DRAFT' AND "invoices"."seller_snapshot" IS NULL;--> statement-breakpoint
UPDATE "quotes" SET "seller_snapshot" = jsonb_build_object(
  'name', o."name", 'legalName', o."legal_name", 'taxId', o."tax_id", 'taxRegistration', o."tax_registration",
  'email', o."email", 'phone', o."phone", 'addressLine1', o."address_line1", 'addressLine2', o."address_line2",
  'city', o."city", 'region', o."region", 'postalCode', o."postal_code")
FROM "organizations" o
WHERE "quotes"."organization_id" = o."id" AND "quotes"."status" <> 'DRAFT' AND "quotes"."seller_snapshot" IS NULL;
