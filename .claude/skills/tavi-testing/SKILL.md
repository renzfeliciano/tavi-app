---
name: tavi-testing
description: How TAVI is tested — the test pyramid and commands, the test-first procedure, where each kind of test lives, fixtures, integration and E2E patterns, and the gotchas already learned. Use before writing any code in tavi-app (tests come first) and whenever a test fails unexpectedly.
---

# TAVI testing

## Commands

| Command | What | When |
|---|---|---|
| `npm test` | Unit (`*.test.ts`, node) + components (`*.test.tsx`, jsdom) | Every change; pre-commit hook |
| `npm run test:int` | Integration (`*.int.test.ts`) on real Postgres — Neon `test` branch, **wiped** | Any data/use-case change |
| `npm run test:e2e` | Playwright, desktop + Pixel 7, own server on :3201 against the test DB | Any UI/flow change |
| `CI=1 npx playwright test` | Same against a **production build** (strict CSP, rate limits on) | Before committing security/header/auth changes |

## Test-first procedure (mandatory for logic)

1. Write the test in the right file; run it; **confirm it fails for the right reason** (a stub that throws "not implemented" is fine).
2. Implement the smallest thing that passes.
3. Beware tests that pass for the wrong reason (e.g. a stub that throws satisfying `rejects.toThrow()`); tighten them (`rejects.toMatchObject({ cause: { code: "23503" } })`).
4. Any change to tested code updates its tests in the same change.

## What each change must add

| Change | Tests |
|---|---|
| Domain rule / calculation / state machine | Unit; table-driven for transitions; property tests (fast-check) for money |
| Use case / repository / migration | Integration, including tenant isolation (a second org can't see or touch it) and concurrency where relevant |
| Capability | Update `policy.test.ts` snapshot deliberately |
| Screen / flow | E2E happy path + key failure; add the route to the axe/overflow list |
| Env var | `parse-env.test.ts` (valid, invalid-without-echo, production requirement) |

## Fixtures and helpers

- `@/db/testing`: `testDb()`, `resetTables()`, `closeTestDb()`, `createTestUser()`, `createTestOrganization()`, `listAllAuditEvents()`. Put cross-module fixtures here (the boundary rule blocks tests from reaching into other modules).
- Application functions take `db` as a defaulted parameter → pass `testDb()`.
- `server-only` is aliased to a stub in Vitest; server modules are importable in tests.
- Emails: `setEmailSender(createMemorySender().sender)` and `vi.waitFor` (auth emails are fire-and-forget).
- Better Auth: `createAuth(testDb(), { …, rateLimit: false, checkBreachedPasswords: false })`.

## E2E patterns

- The `setup` project signs up one owner and saves `e2e/.auth/owner.json`; other tests reuse it. Signed-out tests: `test.use({ storageState: { cookies: [], origins: [] } })`.
- Account-creating specs run on desktop only (production sign-up rate limit: 10/min/IP).
- Helpers in `e2e/helpers.ts` (`uniqueEmail`, `strongPassword`, `signUp`, `createBusiness`).
- Screenshots for visual review: a throwaway `e2e/zz-*.spec.ts` writing to the scratchpad with **Windows-style** `C:/…` paths, deleted afterwards.
- Local dev-server runs allow 20s assertions (first-compile + Neon wake-up); CI uses 5s.

## Gotchas already paid for

The E2E server builds into `.next-e2e` (`NEXT_DIST_DIR`), because Next 16 allows one `next dev` per build directory and your own dev server holds `.next`; `AxeBuilder` needs a page from `browser.newContext()`, not `browser.newPage()`; Sonner toasts are list items, so scope `listitem` queries to their region; `getByLabel` also matches `aria-label`led regions (the email-verification banner is "Email verification") and optional fields are named "Email (optional)", so use `getByRole("textbox", { name: /^Email/ })`; Postgres rejects constant `ORDER BY`; Drizzle errors carry the pg error in `cause`; Next's route announcer is a second `role="alert"`; Testing Library needs explicit `cleanup` (done in `vitest.setup.ts`); Intl joins currency codes with a non-breaking space.
