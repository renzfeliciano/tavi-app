import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "@/db/columns";
import { users } from "@/modules/identity/schema";
import { organizations } from "@/modules/organizations/schema";

// Transactional outbox (§46–47): business emails are written in the same
// transaction as the change that causes them, then delivered by a
// dispatcher. A failed send never rolls back or corrupts financial state.
export const outboxMessages = pgTable(
  "outbox_messages",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    // The person whose action queued this email, when a person did (a customer's
    // decision or the daily job has none). Counted by the per-person email cap.
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["email"] }).notNull(),
    // Full message until sent; reduced to recipient and subject afterwards,
    // because bodies can carry links that work as credentials.
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("outbox_messages_due_idx").on(t.status, t.nextAttemptAt),
    // The per-business email limit counts recent rows (document-email-limit.ts).
    index("outbox_messages_organization_created_idx").on(t.organizationId, t.createdAt),
    // The per-person cap (document-email-limit.ts) and the global one count recent rows.
    index("outbox_messages_actor_created_idx").on(t.actorUserId, t.createdAt),
    index("outbox_messages_created_idx").on(t.createdAt),
    check("outbox_messages_status", sql`${t.status} in ('pending', 'sent', 'failed')`),
    check("outbox_messages_kind", sql`${t.kind} in ('email')`),
  ],
);
