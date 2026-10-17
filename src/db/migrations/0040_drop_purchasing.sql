-- Purchase orders and suppliers were removed to keep Tavi on its core purpose.
-- IRREVERSIBLE: this deletes every supplier, purchase order and purchase order line.
-- Take a Neon snapshot or branch before it runs against production.
DELETE FROM "document_sequences" WHERE "kind" = 'purchase_order';--> statement-breakpoint
ALTER TABLE "document_sequences" DROP CONSTRAINT "document_sequences_kind";--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_kind" CHECK ("document_sequences"."kind" in ('quote', 'invoice', 'receipt'));--> statement-breakpoint
DROP TABLE "purchase_order_lines" CASCADE;--> statement-breakpoint
DROP TABLE "purchase_orders" CASCADE;--> statement-breakpoint
DROP TABLE "suppliers" CASCADE;
