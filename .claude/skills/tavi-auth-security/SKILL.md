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

7-day idle (sliding, renewed ≤ once/day), 30-day absolute (enforced in `getCurrentSession`), fresh-auth 15 min for sensitive changes, cookie cache **off** (instant revocation), cookies prefixed `tavi`. Password change revokes other sessions; reset revokes all.

- Sign-in / sign-up / reset / resend-verification forms use `authClient` (`@/lib/auth-client`) so Better Auth's rate limits apply. Server-side `auth.api.*` calls bypass them.
- Error copy via `authErrorMessage` (`@/modules/identity/client`). Sign-in and reset stay enumeration-safe; sign-up may say an email exists (deliberate, rate-limited).
- Breached-password check fails closed (sign-up asks to retry if the API is down).
- Device lists never select tokens; revocation is by session ID scoped to the user.

## Headers & browser

Nonce CSP per request (`src/shared/security/headers.ts`, applied in `src/proxy.ts`): strict `script-src` with nonce + `strict-dynamic`, no eval in production, `frame-ancestors 'none'`. Static headers in `next.config.ts`. No `dangerouslySetInnerHTML` (lint), no inline scripts, no third-party scripts — especially never on public portals (the token is in the URL).

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
- Any new command that emails a customer checks `documentEmailsAllowed` (50/hour per business) **before** it changes anything.
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
