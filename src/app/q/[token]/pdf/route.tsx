import { headers } from "next/headers";
import { PORTAL_RATE_LIMIT } from "@/components/portal/portal-unavailable";
import { DocumentPdf } from "@/components/document/pdf/document-pdf";
import { pdfResponse } from "@/components/document/pdf/pdf-response";
import { marketFor } from "@/config/markets";
import { getSharedQuote } from "@/modules/quotes";
import { consumeRateLimit } from "@/modules/system";
import { clientIp } from "@/shared/http/client-ip";
import { pdfLetterhead } from "../../../(app)/_documents/pdf-letterhead";
import { quoteDocumentView } from "../../../(app)/quotes/_lib/quote-view";

// The customer's PDF of a quote (§G.4). The link token is the authorization;
// it's rate-limited like the page.
export async function GET(_request: Request, context: RouteContext<"/q/[token]/pdf">) {
  const limit = await consumeRateLimit(`portal:${clientIp(await headers())}`, PORTAL_RATE_LIMIT);
  if (!limit.allowed) return new Response("Too many requests", { status: 429 });
  const { token } = await context.params;
  const shared = await getSharedQuote(token);
  if (!shared) return new Response("Not found", { status: 404 });
  const market = marketFor(shared.countryCode);
  const view = quoteDocumentView(shared.quote, {
    business: await pdfLetterhead(shared.organizationId, shared.business, market),
    market,
    locale: shared.locale,
  });
  return pdfResponse(<DocumentPdf view={view} />, `${view.title} ${shared.quote.number ?? ""}`);
}
