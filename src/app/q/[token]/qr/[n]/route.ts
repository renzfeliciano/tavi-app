import { headers } from "next/headers";
import { PORTAL_RATE_LIMIT } from "@/components/portal/portal-unavailable";
import { getSharedQuote } from "@/modules/quotes";
import { consumeRateLimit } from "@/modules/system";
import { clientIp } from "@/shared/http/client-ip";
import { pickQr, qrImageResponse } from "@/shared/http/qr-response";

// A payment QR code as an image, for the business's email (mail apps can't
// draw one). The link token is the authorization: no valid link, no QR. Only
// the codes the document was sent with are served (D25). Rate-limited in its
// own bucket, like the logo, so the images don't use up the page's budget.
// (Typed by hand: the generated route types only know a new route after a dev/build run.)
export async function GET(_request: Request, context: { params: Promise<{ token: string; n: string }> }) {
  const limit = await consumeRateLimit(`portal-qr:${clientIp(await headers())}`, PORTAL_RATE_LIMIT);
  if (!limit.allowed) return new Response("Too many requests", { status: 429 });
  const { token, n } = await context.params;
  const shared = await getSharedQuote(token);
  if (!shared) return new Response("Not found", { status: 404 });
  const qr = pickQr(shared.business.paymentQrs ?? [], n);
  if (!qr) return new Response("Not found", { status: 404 });
  return qrImageResponse(qr.value);
}
