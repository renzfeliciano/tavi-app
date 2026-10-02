ALTER TABLE "organizations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "closed_at" timestamp with time zone;