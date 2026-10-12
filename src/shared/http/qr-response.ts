import { qrPng } from "@/shared/qr/qr-png";

/** The payment QR at position `n` ("0", "1", "2") of a document's list, or null when there isn't one. */
export function pickQr<T>(qrs: readonly T[], n: string): T | null {
  return /^\d$/.test(n) ? (qrs[Number(n)] ?? null) : null;
}

/**
 * A QR code as an image response, for the business's emails. Like the logo,
 * it's never cached or sent on: the document's link is the authorization.
 */
export async function qrImageResponse(value: string): Promise<Response> {
  const png = await qrPng(value);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.byteLength),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
