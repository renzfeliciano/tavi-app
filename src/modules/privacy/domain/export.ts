import { brand } from "@/config/brand";

// "Download your data" (proposal §M 1.13c, D16): one JSON file with
// everything a business keeps in Tavi, so it can take it elsewhere (RA 10173
// Sec. 18, data portability).

export const EXPORT_FORMAT = `${brand.name.toLowerCase()}-export`;
/** Bump when the file's shape changes in a way a reader would notice. */
export const EXPORT_VERSION = 1;

/** Downloads per person; each one reads the whole business. */
export const EXPORT_RATE_LIMIT = { windowSeconds: 10 * 60, max: 5 } as const;

/** Read by whoever opens the file later, so it explains its own units. */
export const EXPORT_NOTES = {
  amounts:
    "Amounts (fields ending in Minor) are whole numbers of the currency's smallest unit (for example centavos); divide by 100 for most currencies.",
  quantities: "Quantities are exact decimals as text.",
  taxRates: "Tax rates (fields ending in Bps) are in basis points: 1200 means 12%.",
  logo: "The logo isn't included; download it from Settings, Business profile.",
} as const;

/** ASCII-only file name with the business's calendar date. */
export function exportFileName(date: string): string {
  return `${EXPORT_FORMAT}-${date}.json`;
}

/** Puts each document's lines on it, in the order given, dropping lines with no document. */
export function attachLines<D extends { id: string }, L>(
  documents: readonly D[],
  lines: readonly L[],
  documentIdOf: (line: L) => string,
): (D & { lines: L[] })[] {
  const byDocument = new Map<string, L[]>();
  for (const line of lines) {
    const id = documentIdOf(line);
    const list = byDocument.get(id);
    if (list) list.push(line);
    else byDocument.set(id, [line]);
  }
  return documents.map((document) => ({ ...document, lines: byDocument.get(document.id) ?? [] }));
}

/** Pretty JSON; dates become ISO strings and any bigint becomes text, so nothing is lost. */
export function serializeExport(data: unknown): string {
  return JSON.stringify(data, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2);
}
