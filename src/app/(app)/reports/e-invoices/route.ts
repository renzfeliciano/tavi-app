import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { eInvoicesForPeriod, parseReportPeriod } from "@/modules/reports";
import { todayIn } from "@/shared/dates/calendar";
import { jsonDownload } from "../../_documents/json-download";

// The period's registered invoices as one e-invoice JSON file (D19), prepared
// for the BIR's Electronic Invoicing System; the file says TAVI isn't
// certified yet. Owners and admins only, like the CSVs.
export async function GET(request: Request): Promise<Response> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "reports.read")) return new Response("Not found", { status: 404 });
  const { period, error } = parseReportPeriod(Object.fromEntries(new URL(request.url).searchParams), todayIn(ctx.timezone));
  if (error) return new Response(error, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const file = await eInvoicesForPeriod(ctx, { period, market: ctx.market });
  return jsonDownload(file, `e-invoices-${period.from}-to-${period.to}`);
}
