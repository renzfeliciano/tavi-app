import { z } from "zod";
import { examplePrice, parseMoneyInput } from "@/shared/money";
import { parsePercentToBps } from "@/shared/numbers/percent";
import { calculateDocument, type LineDiscount } from "./calculation";
import { formatQuantity, parseQuantityInput } from "./quantity";

// Line items as the editor sends them (every field a typed string) and as
// quotes and invoices store them. Parsing happens once the document's
// currency is known, because prices are read in its decimals.

export const DOCUMENT_LIMITS = {
  lines: 200,
  description: 1000,
  unitLabel: 20,
  notes: 2000,
  terms: 2000,
} as const;

export const DISCOUNT_KINDS = ["none", "percent", "amount"] as const;
export const LINE_SOURCE_KINDS = ["product", "service"] as const;
export type LineSourceKind = (typeof LINE_SOURCE_KINDS)[number];

export type RawLine = {
  description: string;
  quantity: string;
  unitLabel: string;
  unitPrice: string;
  discountKind: (typeof DISCOUNT_KINDS)[number];
  discountValue: string;
  /** One of the business's tax rates, or "" for no tax. Resolved to name + rate by the server. */
  taxRateId: string;
  /** The catalog item the line came from, if any: a back-reference only (§B.1). */
  sourceKind: LineSourceKind | "";
  sourceId: string;
};

export const blankLine = (): RawLine => ({
  description: "",
  quantity: "",
  unitLabel: "",
  unitPrice: "",
  discountKind: "none",
  discountValue: "",
  taxRateId: "",
  sourceKind: "",
  sourceId: "",
});

/** The shape the server accepts from the editor; anything else becomes a blank. */
export const rawLineSchema = z.object({
  description: z.string().catch(""),
  quantity: z.string().catch(""),
  unitLabel: z.string().catch(""),
  unitPrice: z.string().catch(""),
  discountKind: z.enum(DISCOUNT_KINDS).catch("none"),
  discountValue: z.string().catch(""),
  taxRateId: z.string().catch(""),
  sourceKind: z.enum([...LINE_SOURCE_KINDS, ""]).catch(""),
  sourceId: z.string().catch(""),
});

export type ParsedLine = {
  description: string;
  /** Scaled ×10 000. */
  quantity: number;
  unitLabel: string;
  unitPriceMinor: number;
  discount: LineDiscount | null;
  taxRateId: string | null;
  source: { kind: LineSourceKind; id: string } | null;
};

export type LinesResult = { ok: true; lines: ParsedLine[] } | { ok: false; errors: Record<string, string> };

const isUuid = (v: string) => z.uuid().safeParse(v).success;
const isBlank = (line: RawLine) => line.description.trim() === "" && line.unitPrice.trim() === "";

/**
 * Reads the editor's lines. Blank lines are skipped; errors are keyed by
 * `lines.<index>.<field>` (the index in the editor, so the right row lights up).
 */
export function parseDocumentLines(
  rawLines: readonly RawLine[],
  { currency, locale }: { currency: string; locale: string },
): LinesResult {
  if (rawLines.length > DOCUMENT_LIMITS.lines) {
    return { ok: false, errors: { lines: `Use up to ${DOCUMENT_LIMITS.lines} lines.` } };
  }
  const errors: Record<string, string> = {};
  const lines: ParsedLine[] = [];

  rawLines.forEach((line, index) => {
    if (isBlank(line)) return;
    const error = (field: keyof RawLine, message: string) => {
      errors[`lines.${index}.${field}`] = message;
    };

    const description = line.description.trim();
    if (description === "") error("description", "Describe this line.");
    else if (description.length > DOCUMENT_LIMITS.description) {
      error("description", `Use ${DOCUMENT_LIMITS.description.toLocaleString("en")} characters or fewer.`);
    }

    const quantity = parseQuantityInput(line.quantity, locale);
    if (quantity === null) error("quantity", `Enter a quantity like ${formatQuantity(15_000, locale)}.`);

    const unitLabel = line.unitLabel.trim();
    if (unitLabel === "" || unitLabel.length > DOCUMENT_LIMITS.unitLabel) error("unitLabel", "Enter a unit.");

    const unitPriceMinor = parseMoneyInput(line.unitPrice, currency, locale);
    if (unitPriceMinor === null) error("unitPrice", `Enter a price like ${examplePrice(currency, locale)}.`);

    let discount: LineDiscount | null = null;
    if (line.discountKind === "percent") {
      const bps = parsePercentToBps(line.discountValue, locale);
      if (bps === null) error("discountValue", "Enter a discount from 0 to 100%.");
      else discount = { kind: "percent", bps };
    } else if (line.discountKind === "amount") {
      const amountMinor = parseMoneyInput(line.discountValue, currency, locale);
      if (amountMinor === null) error("discountValue", `Enter a discount like ${examplePrice(currency, locale)}.`);
      else discount = { kind: "amount", amountMinor };
    }

    const taxRateId = line.taxRateId === "" ? null : line.taxRateId;
    if (taxRateId !== null && !isUuid(taxRateId)) error("taxRateId", "Choose a tax rate from the list.");

    const source =
      line.sourceKind !== "" && isUuid(line.sourceId) ? { kind: line.sourceKind, id: line.sourceId } : null;

    if (quantity === null || unitPriceMinor === null) return;
    // Worst case (100% tax on top) must still be calculable exactly.
    try {
      calculateDocument({
        taxMode: "exclusive",
        lines: [{ unitPriceMinor, quantity, discount: null, tax: { name: "", rateBps: 10_000 } }],
      });
    } catch {
      error("unitPrice", "This line is too large. Split it into smaller lines.");
      return;
    }
    lines.push({ description, quantity, unitLabel, unitPriceMinor, discount, taxRateId, source });
  });

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, lines };
}
