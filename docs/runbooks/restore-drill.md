# Backup restore drill

Proves that production data can be brought back from Neon's history, **without touching production**. Do it before the private beta, then every quarter and after any database-plan change. About 20 minutes.

Neon's backup is point-in-time restore from the branch history (Free plan: **6 hours**; Launch: up to 7 days; Scale: up to 30 days). Anything older than the window is gone, so the history window is the backup policy: move to a paid plan before real businesses rely on TAVI (proposal risk 14).

## What you need

- The Neon console for project `tavi-app` (AWS Singapore).
- The **direct** (non-pooled) connection string of the `production` branch.
- This repo with `npm install` done. Commands below are PowerShell; on macOS/Linux use `RESTORE_CHECK_URL=… npm run …`.

## Steps

1. **Fingerprint production.** Takes a row count and a content hash of every table; it reads only and prints no data.

   ```powershell
   $env:RESTORE_CHECK_URL = "<production direct connection string>"
   npm run db:restore-check -- save drill-production.json
   ```

   Note the time it prints. It is the moment you will restore to.

2. **Wait a minute, then change something you can recognise** (so the drill proves the restore went back in time): in the live app, add a customer named `Restore drill <date>`.

3. **Restore into a new branch, never into `production`.** Neon console → Branches → New branch → parent `production` → "Past point in time" → the time from step 1 (a minute after it is fine, before step 2's change). Name it `restore-drill`. Copy its direct connection string.

   Do **not** use "Restore from history" on `production` itself for a drill: that overwrites the live timeline (Neon keeps the old state as `production_old_<timestamp>`, but customers would see the rollback).

4. **Verify the restored branch matches the fingerprint.**

   ```powershell
   $env:RESTORE_CHECK_URL = "<restore-drill direct connection string>"
   npm run db:restore-check -- check drill-production.json
   ```

   Expect `Restore verified: N tables match…`. Any other output lists the tables that differ; a mismatch on `customers` alone usually means the branch point was after step 2. Pick an earlier time and repeat.

5. **Open the restored data in the app.** In `.env.local`, point `DATABASE_URL` and `DATABASE_URL_DIRECT` at `restore-drill` temporarily, run `npm run build && npm start`, sign in with your own account, and open a quote, a billing statement and its PDF. The `Restore drill` customer must **not** exist. Put `.env.local` back afterwards.

6. **Clean up.** Delete the `restore-drill` branch in Neon, delete `drill-production.json`, and archive the `Restore drill` customer in production.

7. **Record it** in the table below: date, who, how long steps 3–5 took (your recovery time), and anything that surprised you.

## In a real incident

1. Find the last good moment (Neon's Time Travel Assist runs read-only queries against past points).
2. Restore it into a branch and run steps 4–5 there first.
3. Then either point production's connection strings at the verified branch (fastest, keeps the bad timeline for investigation) or use "Restore from history" on `production` (Neon keeps the pre-restore state as `production_old_<timestamp>`).
4. Anything written after the restore point is lost: the audit log of the old branch shows what to re-enter, and payments recorded in that gap must be re-recorded by the business.

## Drill log

| Date | By | Recovery time (steps 3–5) | Notes |
|---|---|---|---|
| | | | |
