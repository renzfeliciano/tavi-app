import { DocumentPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import { getQuote } from "@/modules/quotes";
import { pdfLetterhead } from "../../../_documents/pdf-letterhead";
import { quoteDocumentView } from "../../_lib/quote-view";

// A member's PDF of a quote (drafts included, numbered "Draft").
export async function GET(_request: Request, context: RouteContext<"/quotes/[id]/pdf">) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const quote = await getQuote(ctx, id);
  if (!quote) return new Response("Not found", { status: 404 });
  const business = await pdfLetterhead(ctx.organizationId, await getBusinessProfile(ctx), ctx.market);
  const view = quoteDocumentView(quote, { business, market: ctx.market, locale: ctx.locale });
  return pdfResponse(<DocumentPdf view={view} />, `${view.title} ${quote.number ?? "Draft"}`);
}
