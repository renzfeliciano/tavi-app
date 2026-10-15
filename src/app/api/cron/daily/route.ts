import { markOverdueInvoices, runDueSchedules } from "@/modules/invoices";
import { listOrganizationClocks } from "@/modules/organizations";
import { expireQuotesPastValidity } from "@/modules/quotes";
import { purgeExpiredTrash } from "@/modules/trash";
import { todayIn } from "@/shared/dates/calendar";
import { env } from "@/shared/env";
import { logger } from "@/shared/logger";
import { isAuthorizedCronRequest } from "@/shared/security/cron";

// Vercel Cron, daily: the status job (§B.3–4, D5). Each business's "today" is
// its own time zone's, so lapsed quotes become EXPIRED and late invoices
// OVERDUE on the right calendar day. Idempotent: running it twice changes
// nothing more. Commands re-check dates themselves, so a late run is harmless.
// It also makes each recurring schedule's draft when its due date has come (one per due date,
// so a late or doubled run adds nothing), and removes recycle bin items older than 30 days (D27), for every business
// including closed ones.
// Requires `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let expiredQuotes = 0;
  let overdueInvoices = 0;
  let recurringDrafts = 0;
  let recurringPaused = 0;
  let failed = 0;
  for (const { organizationId, timezone } of await listOrganizationClocks()) {
    const today = todayIn(timezone, now);
    try {
      expiredQuotes += await expireQuotesPastValidity(organizationId, today);
      overdueInvoices += await markOverdueInvoices(organizationId, today);
      const recurring = await runDueSchedules(organizationId, today);
      recurringDrafts += recurring.created;
      recurringPaused += recurring.paused;
    } catch (error) {
      // One business's failure mustn't stop the others; tomorrow's run retries.
      failed += 1;
      logger.error("daily status job failed for a business", { organizationId, error });
    }
  }

  let purgedFromTrash = 0;
  try {
    purgedFromTrash = await purgeExpiredTrash(undefined, now);
  } catch (error) {
    failed += 1;
    logger.error("recycle bin cleanup failed", { error });
  }

  (failed > 0 ? logger.warn : logger.info)("daily status job run", { expiredQuotes, overdueInvoices, recurringDrafts, recurringPaused, purgedFromTrash, failed });
  return Response.json({ expiredQuotes, overdueInvoices, recurringDrafts, recurringPaused, purgedFromTrash, failed }, { headers: { "Cache-Control": "no-store" } });
}
