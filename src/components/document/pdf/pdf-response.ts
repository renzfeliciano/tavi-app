import "server-only";
import type { ReactElement } from "react";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "./document-pdf";

/** "Billing statement INV-000001" → "Billing-statement-INV-000001.pdf" (ASCII only, safe in a header). */
export function pdfFileName(name: string): string {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "document"}.pdf`;
}

/**
 * A rendered PDF as a download. Never cached or indexed: it can sit behind a
 * customer's link token (§I), and the business's copy is private too.
 */
export async function pdfResponse(document: ReactElement<DocumentProps>, name: string): Promise<Response> {
  registerPdfFonts();
  const pdf = await renderToBuffer(document);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `attachment; filename="${pdfFileName(name)}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
