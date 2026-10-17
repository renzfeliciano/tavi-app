-- The standalone collection/acknowledgement receipts and the RDO/CPA worksheet were removed to keep Tavi on its
-- core purpose. IRREVERSIBLE: this deletes every standalone receipt and every saved worksheet.
-- Invoice payment acknowledgements are unaffected (they live on the payments table).
-- The REC- number series stays, because payment acknowledgements still use it.
-- Take a Neon snapshot or branch before it runs against production.
DROP TABLE "receipts" CASCADE;--> statement-breakpoint
DROP TABLE "tax_questionnaires" CASCADE;
