CREATE TABLE "trash_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"original_id" uuid NOT NULL,
	"customer_name" text,
	"total_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"payload" jsonb NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "trash_items_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "trash_items_organization_original_unique" UNIQUE("organization_id","kind","original_id"),
	CONSTRAINT "trash_items_kind" CHECK ("trash_items"."kind" in ('invoice', 'quote')),
	CONSTRAINT "trash_items_currency_iso" CHECK ("trash_items"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "trash_items_total_not_negative" CHECK ("trash_items"."total_minor" >= 0),
	CONSTRAINT "trash_items_expires_after_deleted" CHECK ("trash_items"."expires_at" > "trash_items"."deleted_at")
);
--> statement-breakpoint
ALTER TABLE "trash_items" ADD CONSTRAINT "trash_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trash_items" ADD CONSTRAINT "trash_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trash_items_organization_deleted_idx" ON "trash_items" USING btree ("organization_id","deleted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trash_items_expires_idx" ON "trash_items" USING btree ("expires_at");