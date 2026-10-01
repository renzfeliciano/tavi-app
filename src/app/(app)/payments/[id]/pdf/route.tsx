import { AcknowledgementPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { requireOrgContext } from "@/modules/identity";
import { getInvoice, invoiceTitle } from "@/modules/invoices";
import { getBusinessProfile } from "@/modules/organizations";
import { getPayment } from "@/modules/payments";
import { pdfLetterhead } from "../../../_documents/pdf-letterhead";
import { acknowledgementView } from "../../_lib/acknowledgement-view";

// A member's PDF of a payment acknowledgement (voided ones say so).
export async function GET(_request: Request, context: RouteContext<"/payments/[id]/pdf">) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const payment = await getPayment(ctx, id);
  const invoice = payment ? await getInvoice(ctx, payment.invoiceId) : null;
  if (!payment || !invoice) return new Response("Not found", { status: 404 });
  const view = acknowledgementView(payment, {
    invoiceName: `${invoiceTitle(invoice, ctx.market)} ${invoice.number ?? ""}`.trim(),
    customer: invoice.customerSnapshot,
    business: await pdfLetterhead(ctx.organizationId, await getBusinessProfile(ctx), ctx.market),
    market: ctx.market,
    locale: ctx.locale,
  });
  return pdfResponse(<AcknowledgementPdf view={view} />, `${view.title} ${view.number}`);
}
