---
name: tavi-auth-security
description: TAVI's authentication, session, authorization, tenant-isolation and security rules, plus the threat-model checklist. Use for any change to sign-in, sessions, permissions, server actions, route handlers, public links, uploads, headers, secrets or logging in tavi-app.
---

# TAVI auth & security

Proposal §D (sessions), §E (authz), §I (security). This is the operating procedure.

## Every server entry point

```ts
const ctx = await requireOrgContext();   // @/modules/identity — redirects if signed out / no org
assertCan(ctx, "invoices.void");         // @/modules/authz — throws ForbiddenError
```

- Server actions and route handlers call these **themselves**; the `(app)` layout's call doesn't protect actions.
- `proxy.ts` is only an optimistic cookie check. Never rely on it.
- The organization comes from `ctx.organizationId` (session + membership). **Never** from form data, params or headers.
- Foreign IDs return "not found", not "forbidden" (no existence leaks).

## Capabilities

Literal code in `src/modules/authz/domain/policy.ts`. To add one: add it to `CAPABILITIES`, place it in the right group (everyday/administration/ownership), update the proposal §E table, and accept the snapshot change in `policy.test.ts` deliberately. Never branch on role names.

## Sessions (Better Auth 1.7, `src/modules/identity/infra/create-auth.ts`)

30-minute idle (sliding, renewed at most every 5 minutes; the browser's `IdleGuard` warns 60 seconds before and signs out), 30-day absolute (enforced by `requireSession`), fresh-auth 15 min for sensitive changes, cookie cache **off** (instant revocation), cookies prefixed `tavi`. Password change revokes other sessions; reset revokes all.

- Sign-in / sign-up / reset / resend-verification forms use `authClient` (`@/lib/auth-client`) so Better Auth's rate limits apply. Server-side `auth.api.*` calls bypass them.
- Error copy via `authErrorMessage` (`@/modules/identity/client`). Sign-in and reset stay enumeration-safe; sign-up may say an email exists (deliberate, rate-limited).
- Breached-password check fails closed (sign-up asks to retry if the API is down).
- Rate limits are per origin address and path (sign-in and sign-up 10 a minute; reset and resend 5 in 15 minutes), **not per account**; the address comes from `X-Forwarded-For`, which Vercel overwrites. A per-account throttle is a known gap.
- **The terms record is immutable except through `acceptTerms`.** `termsVersion` is a sign-up input field, so Better Auth's `/update-user` would accept it; the `databaseHooks.user.update.before` hook throws `FIELD_NOT_ALLOWED` for it and for `termsAcceptedAt`. Hooks must **throw** to refuse: what they return is merged into the original data, so omitting a key does not strip it.
- Anything that sends mail on a person's behalf needs `emailVerified`: `sendQuote`, `issueInvoice` and `inviteMember` all refuse until the address is confirmed.
- Device lists never select tokens; revocation is by session ID scoped to the user.

## Headers & browser

Nonce CSP per request (`src/shared/security/headers.ts`, applied in `src/proxy.ts`): strict `script-src` with nonce + `strict-dynamic`, no eval in production, `frame-ancestors 'none'`. Static headers in `next.config.ts`. No `dangerouslySetInnerHTML` (lint), no inline scripts, no third-party scripts — especially never on public portals (the token is in the URL).

Every page folder under `src/app/(app)` must be listed in `PROTECTED_PREFIXES` (`src/shared/security/headers.ts`), so a signed-out visitor is redirected by `proxy.ts` instead of being served a page shell; `headers.test.ts` reads the folder and fails on a missing one. `/dev` answers 404 in production from `proxy.ts` (`isDevOnlyPath`), because a streaming page has already sent "200 OK" before its own `notFound()` runs. Pages still call `requireOrgContext()` themselves; the proxy only improves the answer.

## Public links (Phase 1.6)

256-bit random token, **store only its SHA-256**, one document per token, revocable, expiring, rate-limited with `consumeRateLimit` (`@/modules/system`), `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`. Approvals store name, content hash, IP, user agent, and audit + notify.
- Every token route is rate-limited, including the logo routes (`portal-logo:` bucket). Formatting (locale, names) comes from the business's row, never from the browser.
- Action arguments that aren't `FormData` are `unknown` until parsed (e.g. `parseDelivery` for the send dialog): TypeScript types don't reach the server.

## Secrets, env, logs

- All env vars declared and validated in `src/shared/env/parse-env.ts`; errors never echo values. Add new ones there with tests and to `.env.example`.
- Never log bodies, headers, cookies or URLs with query strings. Use `logger` (redacts keys like password/token/secret/cookie and scrubs `scheme://user:pass@`).
- Cron routes: `isAuthorizedCronRequest` (constant-time) with `CRON_SECRET`.
- Client-supplied IDs that reach logs (`x-request-id`) go through `acceptRequestId`.
- Request paths in logs go through `loggablePath` (customer-link tokens are in the path, reset tokens in the query).
- Any new command that queues email for a person calls `emailLimitReached(db, actor, now, adding)` **before** it changes anything, passes `actorUserId: actor.userId` to `enqueueEmail`, and shows `documentEmailLimitMessage(alternative, reason)` for the reason it returns. Three hourly caps, in this order: per business 50, per person across businesses 80, everyone 150 (`src/modules/notifications/domain/document-email-limit.ts`; raise the global one when mail leaves the free Gmail tier).
- Never paste real credentials into chat or commit them; `.env.local` is gitignored.

## Uploads (logo, Phase 1.1)

PNG/JPEG/WebP by magic bytes, ≤ 2 MB, re-encode with sharp, no SVG, random storage key, signed/proxied URLs.

## Threat-model checklist (required for security-sensitive changes)

1. What does an attacker control here (input, IDs, tokens, headers)?
2. Can a user reach another tenant's data (IDOR)? Where is the org scope enforced?
3. Is the capability checked on the server for this exact action?
4. Can it be brute-forced or spammed? Where's the rate limit?
5. What leaks on error (existence, stack traces, secrets in logs)?
6. Is anything rendered as HTML or loaded from a third party?
7. What's audited? Would we be able to reconstruct what happened?
8. Is there a test proving each of the above (unit, integration or E2E)?
9. Does a regular expression, or any loop, run on text a stranger controls? It must be linear-time (SonarJS `super-linear-regex`); cap the input length first.
10. Is a password or email typed into a form that is on screen before the page's script loads (the account pages)? The form needs `method="post"`, or a submit before the script loads puts it in the web address (`src/app/(auth)/form-method.test.tsx`).

Last full review: October 2026 (`docs/runbooks/security-checks.md`: how to re-run it, accepted advisories, open gaps).
