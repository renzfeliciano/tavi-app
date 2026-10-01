import { headers } from "next/headers";
import { PORTAL_RATE_LIMIT } from "@/components/portal/portal-unavailable";
import { AcknowledgementPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { marketFor } from "@/config/markets";
import { getSharedInvoice } from "@/modules/invoices";
import { listPaymentsForSharedInvoice } from "@/modules/payments";
import { consumeRateLimit } from "@/modules/system";
import { clientIp } from "@/shared/http/client-ip";
import { pdfLetterhead } from "../../../../../(app)/_documents/pdf-letterhead";
import { acknowledgementView } from "../../../../../(app)/payments/_lib/acknowledgement-view";

// The customer's PDF of one payment acknowledgement on their invoice (§G.4).
// The invoice's link token is the authorization; only active payments on that
// invoice can be fetched.
export async function GET(_request: Request, context: RouteContext<"/i/[token]/receipts/[number]/pdf">) {
  const limit = await consumeRateLimit(`portal:${clientIp(await headers())}`, PORTAL_RATE_LIMIT);
  if (!limit.allowed) return new Response("Too many requests", { status: 429 });
  const { token, number } = await context.params;
  const shared = await getSharedInvoice(token);
  if (!shared) return new Response("Not found", { status: 404 });
  const payment = (await listPaymentsForSharedInvoice(shared.organizationId, shared.invoice.id)).find(
    (p) => p.receiptNumber === number,
  );
  if (!payment) return new Response("Not found", { status: 404 });
  const market = marketFor(shared.countryCode);
  const view = acknowledgementView(payment, {
    invoiceName: `${market.documents.invoice.singular} ${shared.invoice.number ?? ""}`.trim(),
    customer: shared.invoice.customerSnapshot,
    business: await pdfLetterhead(shared.organizationId, shared.business, market),
    market,
    locale: shared.locale,
  });
  return pdfResponse(<AcknowledgementPdf view={view} />, `${view.title} ${view.number}`);
}
