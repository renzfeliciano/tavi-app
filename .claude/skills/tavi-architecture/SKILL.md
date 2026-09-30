---
name: tavi-architecture
description: TAVI's modular-monolith rules — where code goes, module anatomy, dependency direction, the use-case pattern, and how to record architecture decisions. Use before adding a feature, a module, a table, a route or a cross-module call in tavi-app, and when reviewing whether code sits in the right layer.
---

# TAVI architecture

Source of truth: `docs/foundation-proposal.md` §A (shape), §M (roadmap) and the decision log (D1–D10). This skill is the working procedure.

## Where code goes

| You are writing… | It lives in |
|---|---|
| A route, layout, route handler, server action | `src/app/**` — thin: parse input, call **one** use case, map the result |
| Business rules, state machines, calculations | `src/modules/<name>/domain/` — pure TS, no framework/db |
| A use case (authz + transaction + audit + outbox) | `src/modules/<name>/application/` |
| Queries and repositories | `src/modules/<name>/infra/` (always org-scoped) |
| Tables | `src/modules/<name>/schema.ts`, re-exported from `src/db/schema.ts` |
| The module's public API | `src/modules/<name>/index.ts` (server) and `client.ts` (browser-safe, optional) |
| Cross-cutting helpers (money, env, logger, security) | `src/shared/**` |
| Design-system primitives / domain display components | `src/components/ui/**` / `src/components/**` |
| Test fixtures that touch several modules' tables | `src/db/testing/` |

Current modules: `identity`, `organizations`, `authz`, `documents`, `quotes`, `invoices`, `notifications`, `audit`, `system`. Phase 1 adds `customers`, `catalog`, `payments`.

## Dependency direction (lint-enforced: `tavi/module-boundaries`)

```
app/ → @/modules/<name> (index or client) → application → domain
                                   ↓
                                 infra → @/db
```

- Outside a module, import it only via `@/modules/<name>` or `@/modules/<name>/client`.
- Only `src/db/`, module `application/`, `infra/`, `schema.ts` files and tests may import `@/db` or `drizzle-orm`.
- `domain/` never imports `next`, `react`, `drizzle-orm`, `@/db`, or its own `application/`/`infra/`.
- Exceptions: `schema.ts` (and `src/db/`) may import another module's `schema.ts` for foreign keys.
- `sql.raw` is banned outside `src/db/`.

If the rule blocks you, the design is usually wrong — export what you need from the other module's `index.ts` instead of reaching in.

## The use-case pattern

Every mutation follows this order:

```ts
export async function sendQuote(quoteId: string, db = getDb()) {
  const ctx = await requireOrgContext();          // who + which org (server-side only)
  assertCan(ctx, "quotes.send");                 // capability, never a role check
  return db.transaction(async (tx) => {
    const quote = await findQuote(tx, ctx.organizationId, quoteId); // org-scoped; NotFound if foreign
    const next = transition(quote, "send");      // pure domain rule
    const number = await allocateDocumentNumber(tx, ctx.organizationId, "quote");
    await saveQuote(tx, …);
    await recordAuditEvent(tx, { action: "quote.sent", … });
    await enqueueEmail(tx, …, { organizationId: ctx.organizationId });
  });
  // after commit: flushOutboxAfterResponse()
}
```

Application functions take `db` as a defaulted last parameter so integration tests can pass `testDb()`.

## Recording a decision

Any significant choice (new dependency, new module, schema convention, deviation from the proposal) gets:

1. **Why?** the problem it solves.
2. **Alternatives?** at least one real alternative.
3. **Tradeoffs?** what we give up.
4. **Future impact?** what it makes easier/harder later.

Record founder decisions in the proposal's decision log (next `D` number) and implementation deviations in the relevant section ("As built"). Update `CLAUDE.md` when a rule for future work changes.

## Performance rules

- Server Components fetch; client components receive plain data.
- Paginate lists (keyset on `(created_at, id)`), select only needed columns, add indexes that match real filters.
- No N+1: join or batch.
- No caching layer, Redis or queue until a measurement says so.

## Configuration, not literals (D12)

- Country-specific facts: `src/config/markets.ts` → `ctx.market` (tax suggestions, tax-ID, address labels, document names, currency, locale, time zone).
- Product identity: `src/config/brand.ts`. Offered currencies: `src/config/currencies.ts` (names from `Intl.DisplayNames`).
- Limits and lifetimes: a named constant in the owning module's `domain/`, exported from `index.ts` for the server and `client.ts` for forms; messages are built from it.

## Anti-patterns

Business logic in components or actions; `if (role === "admin")`; trusting an `organizationId` from the client; a helper file that grows into a god module; generic repositories; new top-level folders outside this map.
