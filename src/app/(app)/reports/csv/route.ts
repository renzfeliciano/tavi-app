import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import { withholdingReport } from "@/modules/payments";
import { parseReportPeriod, paymentsReport, salesReport, unpaidReport } from "@/modules/reports";
import { todayIn } from "@/shared/dates/calendar";
import { paymentsCsv, salesCsv, unpaidCsv, withholdingCsv } from "../_lib/report-csv";
import { parseWithholdingQuarter } from "../_lib/withholding-quarter";

// A report as a CSV for the business's accountant (2.2c, D18):
// `?report=sales|payments|unpaid` plus the page's period, or
// `?report=withholding&year=2026&quarter=3` for the 2307 certificates. Owners and admins
// only; anyone else gets the same answer as a missing page.
export async function GET(request: Request): Promise<Response> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "reports.read")) return new Response("Not found", { status: 404 });

  const params = new URL(request.url).searchParams;
  const today = todayIn(ctx.timezone);
  if (params.get("report") === "withholding") {
    if (!ctx.market.taxWithheld) return new Response("Not found", { status: 404 });
    const asked = parseWithholdingQuarter(params.get("year"), params.get("quarter"), today);
    if (!asked.ok) return text(asked.error, 400);
    const report = await withholdingReport(ctx, { year: asked.year, quarter: asked.quarter });
    return csv(withholdingCsv(report.rows, ctx.market, asked), `withholding-${asked.year}-Q${asked.quarter}`);
  }
  const { period, error } = parseReportPeriod(Object.fromEntries(params), today);
  if (error) return text(error, 400);

  let body: string;
  let name: string;
  switch (params.get("report")) {
    case "sales": {
      const [{ rows }, profile] = await Promise.all([
        salesReport(ctx, { period, market: ctx.market }),
        getBusinessProfile(ctx),
      ]);
      const seller = ctx.market.taxRegistrations.find((r) => r.code === profile.taxRegistration)?.invoiceSales ?? null;
      body = salesCsv(rows, ctx.market, seller);
      name = `sales-${period.from}-to-${period.to}`;
      break;
    }
    case "payments":
      body = paymentsCsv((await paymentsReport(ctx, { period })).rows, ctx.market);
      name = `payments-${period.from}-to-${period.to}`;
      break;
    case "unpaid":
      body = unpaidCsv((await unpaidReport(ctx, { today, market: ctx.market })).rows, today);
      name = `unpaid-${today}`;
      break;
    default:
      return new Response("Not found", { status: 404 });
  }
  return csv(body, name);
}

const csv = (body: string, name: string) =>
  new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });

const text = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
