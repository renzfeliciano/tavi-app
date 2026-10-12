ALTER TABLE "files" DROP CONSTRAINT "files_purpose";--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_content_type";--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_byte_size";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "width" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "height" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "taxpayer_type" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "income_tax_option" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_office_code" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_registered_on" date;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "line_of_business" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "industry_code" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "name_registration_authority" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "name_registration_number" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "name_registration_scope" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "name_registration_valid_from" date;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "name_registration_valid_until" date;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "doc_kind" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose_shape" CHECK (("files"."purpose" = 'logo' and "files"."content_type" <> 'application/pdf' and "files"."width" is not null and "files"."height" is not null)
        or ("files"."purpose" = 'registration' and "files"."doc_kind" is not null and "files"."file_name" is not null));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose" CHECK ("files"."purpose" in ('logo', 'registration'));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_content_type" CHECK ("files"."content_type" in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf'));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_byte_size" CHECK ("files"."byte_size" between 1 and 2097152);