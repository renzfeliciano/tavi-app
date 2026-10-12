// The business as it was when a document was issued (D25). Names, tax ID,
// registration, contact and address are kept with the document, so changing
// Settings later never rewrites what was already sent. The logo is a brand
// asset, not legal identity, so it stays the current one.

export type SellerSnapshot = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  taxRegistration: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
};

/** The identity part of the profile, as kept on an issued document. */
export function sellerFrom(profile: SellerSnapshot): SellerSnapshot {
  return {
    name: profile.name,
    legalName: profile.legalName,
    taxId: profile.taxId,
    taxRegistration: profile.taxRegistration,
    email: profile.email,
    phone: profile.phone,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    city: profile.city,
    region: profile.region,
    postalCode: profile.postalCode,
  };
}

/**
 * The profile to print on a document: the snapshot's identity when the
 * document has one, otherwise the live profile (drafts, and documents issued
 * before snapshots existed that were not backfilled).
 */
export function withSeller<T extends SellerSnapshot>(live: T, snapshot: SellerSnapshot | null | undefined): T {
  return snapshot ? { ...live, ...sellerFrom(snapshot) } : live;
}
