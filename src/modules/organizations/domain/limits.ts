// Business profile limits: the schema enforces them and the form's
// `maxLength` attributes read them, so the two can't disagree.
export const BUSINESS_PROFILE_LIMITS = {
  name: 120,
  legalName: 160,
  taxId: 20,
  email: 254,
  phone: 40,
  addressLine: 160,
  city: 80,
  region: 80,
  postalCode: 12,
  longText: 2000,
  /** Also enforced by database checks (migration 0006). */
  quoteValidityDays: { min: 1, max: 365 },
  paymentTermsDays: { min: 0, max: 365 },
} as const;
