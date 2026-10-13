ALTER TABLE "outbox_messages" ADD COLUMN "actor_user_id" uuid;--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_messages_actor_created_idx" ON "outbox_messages" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_messages_created_idx" ON "outbox_messages" USING btree ("created_at");