import { checkReadiness } from "@/modules/system";

// Readiness: can this instance reach the database? Public, so it reports only
// up/down; backlog numbers are logged by the outbox cron instead.
export async function GET() {
  const readiness = await checkReadiness();
  return Response.json(
    { status: readiness.ok ? "ok" : "unavailable", database: readiness.database },
    { status: readiness.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
