import { DocumentPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { requireOrgContext } from "@/modules/identity";
import { countsAsPrint, getInvoice, recordInvoicePrint } from "@/modules/invoices";
import { getBusinessProfile } from "@/modules/organizations";
import { pdfLetterhead } from "../../../_documents/pdf-letterhead";
import { invoiceDocumentView } from "../../_lib/invoice-view";

// A member's PDF of an invoice (drafts included, numbered "Draft"). A PDF of a
// registered invoice is counted: after the first, it says "REPRINT" (D19).
export async function GET(_request: Request, context: RouteContext<"/invoices/[id]/pdf">) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const invoice = await getInvoice(ctx, id);
  if (!invoice) return new Response("Not found", { status: 404 });
  const profile = await getBusinessProfile(ctx);
  const business = await pdfLetterhead(ctx.organizationId, profile, ctx.market);
  const print = countsAsPrint(invoice) ? await recordInvoicePrint(ctx, invoice.id) : null;
  // A draft shows today's payment instructions; an issued invoice keeps the ones it was sent with.
  const view = invoiceDocumentView(
    invoice.status === "DRAFT" ? { ...invoice, paymentInstructions: profile.paymentInstructions } : invoice,
    { business, market: ctx.market, locale: ctx.locale, copy: print?.copy ?? null },
  );
  return pdfResponse(<DocumentPdf view={view} />, `${view.title} ${invoice.number ?? "Draft"}`);
}
