ALTER TABLE "trash_items" DROP CONSTRAINT "trash_items_kind";--> statement-breakpoint
ALTER TABLE "trash_items" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "trash_items" ADD CONSTRAINT "trash_items_kind" CHECK ("trash_items"."kind" in ('invoice', 'quote', 'sent_quote', 'payment', 'certificate'));