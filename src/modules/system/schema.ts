import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Fixed-window request counters for routes Better Auth doesn't cover (public
// quote and invoice links, Phase 1.6). Postgres-backed so limits hold across
// serverless instances without Redis (§I, §O).
export const requestLimits = pgTable("request_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
