import { headers } from "next/headers";
import { PORTAL_RATE_LIMIT } from "@/components/portal/portal-unavailable";
import { readLogoForSharedDocument } from "@/modules/files";
import { getSharedQuote } from "@/modules/quotes";
import { consumeRateLimit } from "@/modules/system";
import { clientIp } from "@/shared/http/client-ip";

// The business's logo on a customer's quote page. The link token is the
// authorization: no valid link, no logo. Rate-limited like every other
// token lookup (§I), in its own bucket so the page's image doesn't halve the
// visitor's page budget.
export async function GET(_request: Request, context: RouteContext<"/q/[token]/logo">) {
  const limit = await consumeRateLimit(`portal-logo:${clientIp(await headers())}`, PORTAL_RATE_LIMIT);
  if (!limit.allowed) return new Response("Too many requests", { status: 429 });
  const { token } = await context.params;
  const shared = await getSharedQuote(token);
  if (!shared) return new Response("Not found", { status: 404 });
  const logo = await readLogoForSharedDocument(shared.organizationId);
  if (!logo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.contentType,
      "Content-Length": String(logo.data.byteLength),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
