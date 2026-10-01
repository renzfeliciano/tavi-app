---
name: tavi-ops
description: Running TAVI — environment variables, Neon branches, migrations in production, health checks, crons, logging, error tracking, email deliverability, CI, deploys and backups. Use when configuring environments, deploying, debugging production, or adding infrastructure to tavi-app.
---

# TAVI operations

Hosting plan: Vercel Hobby (app) + Neon Postgres 18 (Singapore) (D1, D9), free tier only for the initial release (D11). Functions run in `sin1` (`vercel.json` `regions`, next to the database); never remove it — Vercel's default is Washington. ⚠️ Vercel Hobby is non-commercial: move to Pro or another host before charging businesses (risk 14). Proposal §K.

## Environment variables (all validated in `src/shared/env/parse-env.ts`)

| Variable | Required in production | Notes |
|---|---|---|
| `APP_URL` | yes (https; localhost allowed for local prod builds) | Also Better Auth's base URL and only trusted origin |
| `DATABASE_URL` | yes | Pooled (`-pooler`) connection of the environment's branch |
| `DATABASE_URL_DIRECT` | for migrations | Same branch, pooling off |
| `BETTER_AUTH_SECRET` | yes | ≥ 32 chars, unique per environment (`openssl rand -base64 32`) |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | to send email (free tier, D11) | Gmail account + App Password; `EMAIL_FROM` = that Gmail address. `SMTP_HOST`/`SMTP_PORT` default to Gmail 465 |
| `RESEND_API_KEY` | later, with a domain | Takes precedence over SMTP when set. With no transport, production refuses to send (logged) and flows continue |
| `CRON_SECRET` | for crons | ≥ 32 chars; Vercel Cron sends it as a Bearer token |
| `TEST_DATABASE_URL` | never in production | Test branch only |

Never paste values into chat or commit them. `.env.local` is gitignored; `.env.example` documents everything.

## Neon branches

`production` (live), `dev` (local development), `test` (wiped by every test run). Preview deployments can use Neon branch-per-preview later. Point-in-time restore is the backup (Free plan keeps only 6 hours of history). Restore drill: `docs/runbooks/restore-drill.md`, using `npm run db:restore-check -- save|check <file>` (row counts + content hashes per table) against a branch restored from history, never against `production` itself. Before beta, then quarterly.

## Migrations in production

1. Migrations are generated and reviewed locally, committed, and green in CI (`test:int` applies them from scratch).
2. Apply before (or as) the new code deploys: `DATABASE_URL_DIRECT=<production direct> npx drizzle-kit migrate` from a trusted machine or a CI job with the secret.
3. Only additive, backward-compatible migrations in one step; destructive changes take two deploys (expand → migrate code → contract).
4. Never edit an applied migration.

## Health and crons

- `GET /api/health` — liveness (no DB).
- `GET /api/health/ready` — DB reachable → 200, else 503. Point uptime monitoring here.
- `GET /api/cron/daily` — `Authorization: Bearer $CRON_SECRET`; the status job: for each business, in its own time zone, lapsed SENT/VIEWED quotes → EXPIRED and late SENT/PARTIALLY_PAID invoices → OVERDUE (audited as `system`, idempotent, one business's failure doesn't stop the rest). Scheduled in `vercel.json` at 16:05 UTC (just after midnight in Manila); add a run per time zone when a market far from UTC+8 launches.
- `GET /api/cron/outbox` — `Authorization: Bearer $CRON_SECRET`; sends due emails, prunes rate-limit counters, logs backlog (warns if any failed or oldest pending > 15 min). Vercel Hobby allows only daily crons; use Pro (or an external scheduler) for every-5-minutes delivery retries. Immediate delivery happens via `flushOutboxAfterResponse()` regardless.

## Beta funnel

`FUNNEL_DATABASE_URL=<production direct> npm run funnel` prints how many businesses reached each step of the critical path, the median time to first sent quote and where each business stopped (view `business_funnel`, from the audit log). Read-only; run it weekly during the beta.

## Logs and errors

- JSON lines in production via `logger` (`src/shared/logger`); search by `requestId` (`x-request-id` response header).
- `src/instrumentation.ts` logs unhandled server errors (no headers, no query strings).
- Error tracking: Sentry is planned but **not yet connected** — needs a Sentry project + DSN, then `@sentry/nextjs` wired into the same `onRequestError` hook with PII scrubbing.

## Email

**Now (free tier, D11):** Gmail SMTP via an App Password (2-Step Verification required), roughly 500 emails/day. E2E runs blank the email settings so tests never send real mail. Keep customer documents primarily on copy-link.

**Later (before growth):** verify a sending subdomain in Resend (e.g. `mail.tavi.ph`) with SPF, DKIM and DMARC; set `EMAIL_FROM="Tavi <notify@mail.tavi.ph>"`; customer emails use "Business via Tavi" with Reply-To the business.

## CI (GitHub Actions)

`checks` (lint, typecheck, unit) → `integration` (postgres:18 service) and `e2e` (postgres:18, one-off auth secret, production build, desktop + mobile). All must pass before merging to `main`.

## Dependency advisories

Run `npm audit --omit=dev` before each release. **Accepted (2026-09-30):** GHSA-67mh-4wv8-2f99 (moderate), an old `esbuild` under `drizzle-kit` (which `better-auth` also declares for its CLI). It affects esbuild's development server only, which TAVI never runs; `npm audit fix --force` would downgrade drizzle-kit and break migrations. Re-check when drizzle-kit or better-auth release updates.

## Deploy checklist

First deploy, step by step: `docs/runbooks/production-deploy.md`.


CI green · migrations applied · env vars set for the environment · `/api/health/ready` 200 after deploy · sign-up → onboarding smoke test on the live URL · logs clean for 10 minutes.
