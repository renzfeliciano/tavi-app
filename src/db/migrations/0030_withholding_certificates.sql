CREATE TABLE "withholding_certificate_lines" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"certificate_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"atc_code" text NOT NULL,
	"description" text,
	"rate_bps" integer NOT NULL,
	"month1_minor" bigint NOT NULL,
	"month2_minor" bigint NOT NULL,
	"month3_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"tax_withheld_minor" bigint NOT NULL,
	CONSTRAINT "withholding_lines_position_unique" UNIQUE("certificate_id","position"),
	CONSTRAINT "withholding_lines_position" CHECK ("withholding_certificate_lines"."position" between 1 and 5),
	CONSTRAINT "withholding_lines_atc" CHECK ("withholding_certificate_lines"."atc_code" ~ '^[A-Z0-9]{1,10}$'),
	CONSTRAINT "withholding_lines_rate" CHECK ("withholding_certificate_lines"."rate_bps" between 1 and 10000),
	CONSTRAINT "withholding_lines_months" CHECK ("withholding_certificate_lines"."month1_minor" >= 0 and "withholding_certificate_lines"."month2_minor" >= 0 and "withholding_certificate_lines"."month3_minor" >= 0),
	CONSTRAINT "withholding_lines_total" CHECK ("withholding_certificate_lines"."total_minor" = "withholding_certificate_lines"."month1_minor" + "withholding_certificate_lines"."month2_minor" + "withholding_certificate_lines"."month3_minor" and "withholding_certificate_lines"."total_minor" > 0),
	CONSTRAINT "withholding_lines_tax" CHECK ("withholding_certificate_lines"."tax_withheld_minor" > 0 and "withholding_certificate_lines"."tax_withheld_minor" <= "withholding_certificate_lines"."total_minor")
);
--> statement-breakpoint
CREATE TABLE "withholding_certificate_payments" (
	"organization_id" uuid NOT NULL,
	"certificate_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	CONSTRAINT "withholding_certificate_payments_pk" PRIMARY KEY("certificate_id","payment_id"),
	CONSTRAINT "withholding_certificate_payments_payment_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "withholding_certificates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"payor_tin" text NOT NULL,
	"payor_name" text NOT NULL,
	"payor_address" text,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"received_on" date NOT NULL,
	"currency" char(3) NOT NULL,
	"file_id" uuid,
	"notes" text,
	"created_by" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withholding_certificates_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "withholding_certificates_period" CHECK ("withholding_certificates"."period_from" <= "withholding_certificates"."period_to"),
	CONSTRAINT "withholding_certificates_one_quarter" CHECK (date_trunc('quarter', "withholding_certificates"."period_from"::timestamp) = date_trunc('quarter', "withholding_certificates"."period_to"::timestamp)),
	CONSTRAINT "withholding_certificates_void_reason" CHECK ("withholding_certificates"."voided_at" is null or "withholding_certificates"."void_reason" is not null),
	CONSTRAINT "withholding_certificates_currency_iso" CHECK ("withholding_certificates"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_purpose";--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_purpose_shape";--> statement-breakpoint
ALTER TABLE "withholding_certificate_lines" ADD CONSTRAINT "withholding_certificate_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificate_lines" ADD CONSTRAINT "withholding_lines_certificate_fk" FOREIGN KEY ("organization_id","certificate_id") REFERENCES "public"."withholding_certificates"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificate_payments" ADD CONSTRAINT "withholding_certificate_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificate_payments" ADD CONSTRAINT "withholding_certificate_payments_certificate_fk" FOREIGN KEY ("organization_id","certificate_id") REFERENCES "public"."withholding_certificates"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificate_payments" ADD CONSTRAINT "withholding_certificate_payments_payment_fk" FOREIGN KEY ("organization_id","payment_id") REFERENCES "public"."payments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_customer_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "public"."customers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "withholding_certificates_period_idx" ON "withholding_certificates" USING btree ("organization_id","period_from" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "withholding_certificates_customer_idx" ON "withholding_certificates" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose" CHECK ("files"."purpose" in ('logo', 'registration', 'withholding_certificate'));--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_purpose_shape" CHECK (("files"."purpose" = 'logo' and "files"."content_type" <> 'application/pdf' and "files"."width" is not null and "files"."height" is not null)
        or ("files"."purpose" = 'registration' and "files"."doc_kind" is not null and "files"."file_name" is not null)
        or ("files"."purpose" = 'withholding_certificate' and "files"."doc_kind" is null and "files"."file_name" is not null));