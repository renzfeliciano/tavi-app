import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "@/db/columns";
import { organizations } from "@/modules/organizations/schema";
import { AUDIT_ACTOR_TYPES } from "./domain/events";

// Append-only history of what happened (§39). A database trigger (migration
// 0003) rejects UPDATE and DELETE, so history can't be rewritten, even by a
// bug in our own code. Actors are stored by id without a foreign key, so the
// record survives if a user account is later removed.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    actorType: text("actor_type", { enum: AUDIT_ACTOR_TYPES }).notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_events_entity_idx").on(t.organizationId, t.entityType, t.entityId, t.createdAt),
    index("audit_events_org_time_idx").on(t.organizationId, t.createdAt.desc()),
    check("audit_events_actor_type", sql`${t.actorType} in ('user', 'customer', 'system')`),
  ],
);
