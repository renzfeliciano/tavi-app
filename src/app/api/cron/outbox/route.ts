import { dispatchOutbox, getOutboxStats } from "@/modules/notifications";
import { pruneRateLimits } from "@/modules/system";
import { env } from "@/shared/env";
import { logger } from "@/shared/logger";
import { isAuthorizedCronRequest } from "@/shared/security/cron";

// Vercel Cron: retries queued emails (§47) and tidies expired rate-limit
// counters. Requires `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dispatched = await dispatchOutbox();
  const pruned = await pruneRateLimits();
  const outbox = await getOutboxStats();

  const log = outbox.failed > 0 || outbox.oldestPendingSeconds > 15 * 60 ? logger.warn : logger.info;
  log("outbox cron run", { dispatched, prunedRateLimits: pruned, outbox });

  return Response.json({ dispatched, prunedRateLimits: pruned }, { headers: { "Cache-Control": "no-store" } });
}
