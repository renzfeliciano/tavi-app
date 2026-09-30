// Customer field limits: the schema enforces them and the form's `maxLength`
// attributes read them.
export const CUSTOMER_LIMITS = {
  displayName: 120,
  company: 160,
  email: 254,
  phone: 40,
  addressLine: 160,
  city: 80,
  region: 80,
  postalCode: 12,
  taxId: 20,
  notes: 2000,
} as const;

/** Customers per page in the list. */
export const CUSTOMER_PAGE_SIZE = 25;
