ALTER TABLE "payments" DROP CONSTRAINT "payments_method";--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "payment_qrs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payer_name" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_time" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cheque_date" date;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_payment_qrs" CHECK (jsonb_typeof("organizations"."payment_qrs") = 'array' and jsonb_array_length("organizations"."payment_qrs") <= 3);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_paid_time" CHECK ("payments"."paid_time" is null or "payments"."paid_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_method" CHECK ("payments"."method" in ('bank_transfer', 'ewallet', 'bank_deposit', 'cash', 'card', 'cheque', 'other'));