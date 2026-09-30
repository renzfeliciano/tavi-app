import { readLogoForSharedDocument } from "@/modules/files";
import { getSharedInvoice } from "@/modules/invoices";

// The business's logo on a customer's invoice page. The link token is the
// authorization: no valid link, no logo.
export async function GET(_request: Request, context: RouteContext<"/i/[token]/logo">) {
  const { token } = await context.params;
  const shared = await getSharedInvoice(token);
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
