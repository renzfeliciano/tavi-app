# First production deploy

From an empty Vercel project to a live TAVI on the Neon `production` branch. About an hour the first time. Later deploys are just "push to `main`", plus step 4 when a release adds a migration. The short checklist lives in the `tavi-ops` skill.

⚠️ Vercel Hobby is for non-commercial use. It's fine for the private beta while nobody pays; move to Pro (or another host) before charging businesses (proposal risk 14).

## 1. Push the code

The GitHub repo `renzfeliciano/tavi-app` is still empty. From the repo, on your personal account:

```powershell
git push -u origin main
```

GitHub Actions then runs CI (lint, typecheck, unit, integration and E2E on Postgres 18). **Don't deploy until it's green.**

## 2. Prepare the values

Create these once, keep them in your password manager, and never paste them into chat or commit them:

| Variable | Value |
|---|---|
| `APP_URL` | The production URL, `https://…` (Vercel's `*.vercel.app` until a domain exists) |
| `DATABASE_URL` | Neon `production` branch, **pooled** (`-pooler`) connection string |
| `DATABASE_URL_DIRECT` | Neon `production` branch, direct connection string |
| `BETTER_AUTH_SECRET` | New value: `openssl rand -base64 32` (never reuse dev's) |
| `CRON_SECRET` | New value: `openssl rand -base64 32` |
| `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | The sending Gmail account and its App Password (`tavi-ops` → Email) |

Leave `TEST_DATABASE_URL` and `RESEND_API_KEY` unset in production.

## 3. Create the Vercel project

1. Vercel → Add New → Project → import `tavi-app`. Framework: Next.js, defaults otherwise.
2. Settings → Environment Variables: add every value from step 2 for **Production** only.
3. Settings → Functions: confirm the region shows **Singapore (sin1)**. It comes from `vercel.json`; the default (Washington) would put the database across the Pacific.
4. Don't deploy yet if the database is empty (step 4 first).

## 4. Migrate the production database

Run this from your machine, before the first deploy and before any deploy that adds a migration:

```powershell
$env:DATABASE_URL_DIRECT = "<production direct connection string>"
npm run db:migrate
```

Migrations are additive (`tavi-ops` → Migrations in production). Never edit one that has been applied.

## 5. Deploy and check

1. Deploy (Vercel → Deployments → Redeploy, or push to `main`).
2. `https://<app>/api/health` → 200, and `https://<app>/api/health/ready` → 200 (the database is reachable).
3. Vercel → Settings → Cron Jobs shows `/api/cron/daily` (16:05 UTC) and `/api/cron/outbox` (16:20 UTC). Use "Run" once on each and check the logs for `daily status job run` and the outbox summary.
4. Smoke test on the live URL from your phone: sign up with a real address, confirm the email, create the business, add a customer, send a quote by link, open it in a private window, approve it, convert it, record a payment, download the PDF.
5. Watch Vercel's logs for 10 minutes: no `level":"error"` lines.
6. Point an uptime monitor (e.g. a free UptimeRobot check) at `/api/health/ready`.

## 6. Before inviting beta businesses

- Run the [restore drill](restore-drill.md) once on the live data.
- Do the device check from `tavi-ui-ux` on a real low-end Android phone (the E2E matrix uses emulated sizes).
- Ask the RDO/CPA questions in `docs/compliance/ph-e-invoicing.md` (they gate 1.12 invoice mode, not the beta).

## Rolling back

Vercel → Deployments → pick the last good one → "Promote to Production" (instant). A migration can't be rolled back that way, which is why migrations are additive: the previous code keeps working against the new schema.
