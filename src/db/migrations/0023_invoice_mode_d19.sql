ALTER TABLE "invoice_lines" DROP CONSTRAINT "invoice_lines_amounts_not_negative";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_amounts_not_negative";--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "qualified_discount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "tax_waived_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "qualified_discount" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "qualified_discount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_waived_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "print_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "first_printed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_amounts_not_negative" CHECK ("invoice_lines"."gross_minor" >= 0 and "invoice_lines"."discount_minor" >= 0 and "invoice_lines"."tax_minor" >= 0 and "invoice_lines"."total_minor" >= 0 and "invoice_lines"."qualified_discount_minor" >= 0 and "invoice_lines"."tax_waived_minor" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_print_count_not_negative" CHECK ("invoices"."print_count" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amounts_not_negative" CHECK ("invoices"."subtotal_minor" >= 0 and "invoices"."discount_total_minor" >= 0 and "invoices"."tax_total_minor" >= 0 and "invoices"."total_minor" >= 0 and "invoices"."amount_paid_minor" >= 0 and "invoices"."qualified_discount_minor" >= 0 and "invoices"."tax_waived_minor" >= 0);