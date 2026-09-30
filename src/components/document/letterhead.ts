import { type AddressParts, formatAddressLines, type MarketProfile, taxIdStatement } from "@/config/markets";
import type { DocumentView } from "./document-view";

export type LetterheadProfile = AddressParts & {
  name: string;
  legalName: string | null;
  taxId: string | null;
  taxRegistration: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * The business at the top of every document: registered name (and trade
 * name), registration statement with TIN, and address, as RR 7-2024 Sec.
 * 6(B.1–B.3) requires (D13). One builder for every page that shows a document.
 */
export function letterhead(
  profile: LetterheadProfile,
  market: Pick<MarketProfile, "address" | "taxId" | "taxRegistrations">,
  logo: DocumentView["business"]["logo"],
): DocumentView["business"] {
  return {
    name: profile.name,
    subtitle: profile.legalName && profile.legalName !== profile.name ? profile.legalName : null,
    addressLines: formatAddressLines(profile, market),
    contactLines: [profile.email, profile.phone].filter((line): line is string => Boolean(line)),
    taxId: profile.taxId ? { label: taxIdStatement(market, profile.taxRegistration), value: profile.taxId } : null,
    logo,
  };
}
