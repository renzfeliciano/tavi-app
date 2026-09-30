import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "@/db/columns";
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
    check("outbox_messages_status", sql`${t.status} in ('pending', 'sent', 'failed')`),
    check("outbox_messages_kind", sql`${t.kind} in ('email')`),
  ],
);
