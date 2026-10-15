import { DocumentPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile, withSeller } from "@/modules/organizations";
import { getPurchaseOrder } from "@/modules/purchasing";
import { pdfLetterhead } from "../../../_documents/pdf-letterhead";
import { purchaseOrderView } from "../../_lib/po-view";

// A member's PDF of an issued purchase order (received and cancelled ones say so). A draft has no number to print, and
// another business's order is a 404.
export async function GET(
  _request: Request,
  context: RouteContext<"/purchase-orders/[id]/pdf">,
) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const order = await getPurchaseOrder(ctx, id);
  if (!order) return new Response("Not found", { status: 404 });
  if (order.status === "DRAFT")
    return new Response("Issue the purchase order to download it.", {
      status: 404,
    });
  const business = await pdfLetterhead(
    ctx.organizationId,
    withSeller(await getBusinessProfile(ctx), order.sellerSnapshot),
    ctx.market,
  );
  const view = purchaseOrderView(order, {
    business,
    market: ctx.market,
    locale: ctx.locale,
  });
  return pdfResponse(
    <DocumentPdf view={view} />,
    `${view.title} ${order.number ?? "Draft"}`,
  );
}
