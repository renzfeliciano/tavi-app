// Document numbering (docs/foundation-proposal.md §B.6). Allocation happens in
// the database, inside the transaction that issues the document; this file only
// defines the kinds, their defaults and how an allocated value is displayed.

export const DOCUMENT_KINDS = ["quote", "invoice", "receipt"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type NumberingFormat = {
  prefix: string;
  padding: number;
};

export const DEFAULT_NUMBERING: Record<DocumentKind, NumberingFormat> = {
  quote: { prefix: "QUO-", padding: 6 },
  invoice: { prefix: "INV-", padding: 6 },
  receipt: { prefix: "REC-", padding: 6 },
};

/** `formatDocumentNumber({ prefix: "QUO-", padding: 6 }, 124)` gives "QUO-000124". */
export function formatDocumentNumber(format: NumberingFormat, value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`Document number must be a positive integer; received ${value}`);
  }
  return `${format.prefix}${String(value).padStart(format.padding, "0")}`;
}
