import { markOverdueInvoices } from "@/modules/invoices";
import { listOrganizationClocks } from "@/modules/organizations";
import { expireQuotesPastValidity } from "@/modules/quotes";
import { todayIn } from "@/shared/dates/calendar";
import { env } from "@/shared/env";
import { logger } from "@/shared/logger";
import { isAuthorizedCronRequest } from "@/shared/security/cron";

// Vercel Cron, daily: the status job (§B.3–4, D5). Each business's "today" is
// its own time zone's, so lapsed quotes become EXPIRED and late invoices
// OVERDUE on the right calendar day. Idempotent: running it twice changes
// nothing more. Commands re-check dates themselves, so a late run is harmless.
// Requires `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let expiredQuotes = 0;
  let overdueInvoices = 0;
  let failed = 0;
  for (const { organizationId, timezone } of await listOrganizationClocks()) {
    const today = todayIn(timezone, now);
    try {
      expiredQuotes += await expireQuotesPastValidity(organizationId, today);
      overdueInvoices += await markOverdueInvoices(organizationId, today);
    } catch (error) {
      // One business's failure mustn't stop the others; tomorrow's run retries.
      failed += 1;
      logger.error("daily status job failed for a business", { organizationId, error });
    }
  }

  (failed > 0 ? logger.warn : logger.info)("daily status job run", { expiredQuotes, overdueInvoices, failed });
  return Response.json({ expiredQuotes, overdueInvoices, failed }, { headers: { "Cache-Control": "no-store" } });
}
