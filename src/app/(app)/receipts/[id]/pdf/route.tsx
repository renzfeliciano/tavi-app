import { AcknowledgementPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile, withSeller } from "@/modules/organizations";
import { getReceipt } from "@/modules/payments";
import { pdfLetterhead } from "../../../_documents/pdf-letterhead";
import { receiptView } from "../../_lib/receipt-view";

// A member's PDF of a receipt (a void one says so). Another business's receipt is a 404.
export async function GET(_request: Request, context: RouteContext<"/receipts/[id]/pdf">) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const receipt = await getReceipt(ctx, id);
  if (!receipt) return new Response("Not found", { status: 404 });
  const view = receiptView(receipt, {
    business: await pdfLetterhead(ctx.organizationId, withSeller(await getBusinessProfile(ctx), receipt.seller), ctx.market),
    market: ctx.market,
    locale: ctx.locale,
  });
  return pdfResponse(<AcknowledgementPdf view={view} />, `${view.title} ${view.number}`);
}
