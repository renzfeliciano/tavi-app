import "server-only";
import type { DocumentView } from "@/components/document/document-view";
import { letterhead, type LetterheadProfile } from "@/components/document/letterhead";
import type { MarketProfile } from "@/config/markets";
import { readLogoForSharedDocument } from "@/modules/files";

/**
 * The letterhead for a PDF: the same as on screen, with the logo embedded as a
 * data URI (a PDF can't fetch the app's logo URL). Used by members' downloads
 * and by customers' downloads behind their link.
 */
export async function pdfLetterhead(
  organizationId: string,
  profile: LetterheadProfile,
  market: Pick<MarketProfile, "address" | "taxId" | "taxRegistrations">,
): Promise<DocumentView["business"]> {
  const logo = await readLogoForSharedDocument(organizationId);
  return letterhead(
    profile,
    market,
    logo
      ? {
          src: `data:${logo.contentType};base64,${Buffer.from(logo.data).toString("base64")}`,
          width: logo.width,
          height: logo.height,
        }
      : null,
  );
}
