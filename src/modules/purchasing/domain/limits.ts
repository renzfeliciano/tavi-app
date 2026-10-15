// Supplier field limits: the schema enforces them and the form's `maxLength`
// attributes read them.
export const SUPPLIER_LIMITS = {
  displayName: 120,
  contactName: 120,
  email: 254,
  phone: 40,
  addressLine: 160,
  city: 80,
  region: 80,
  postalCode: 12,
  taxId: 20,
  notes: 2000,
} as const;

/** Purchase order text limits: the rules, the forms' `maxLength` and the messages all read these. */
export const PO_LIMITS = {
  notes: 2000,
  terms: 2000,
  /** The reason given when cancelling, and the note given when receiving. */
  cancelReason: 500,
  receiptNote: 500,
} as const;
