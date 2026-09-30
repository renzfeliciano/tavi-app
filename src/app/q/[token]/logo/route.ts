import { readLogoForSharedDocument } from "@/modules/files";
import { getSharedQuote } from "@/modules/quotes";

// The business's logo on a customer's quote page. The link token is the
// authorization: no valid link, no logo.
export async function GET(_request: Request, context: RouteContext<"/q/[token]/logo">) {
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
