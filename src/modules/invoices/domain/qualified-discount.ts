import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import type { DocumentAmounts, QualifiedDiscountInput } from "@/modules/documents/client";
import { tooLong } from "@/shared/validation/messages";

// Qualified discounts on a bill (D19; PH: RR 7-2024 Sec. 6 B.18): a buyer the
// law entitles to a discount (senior citizen, PWD, solo parent, national
// athlete or coach, Medal of Valor awardee) gets it on the whole bill. The
// bill keeps the kind, its rate and tax treatment as they were, the buyer's
// ID number and name, and prints the discount and tax-exemption breakdown with
// a signature line. The one calculation (calculateDocument) does the maths.

export type QualifiedDiscountConfig = NonNullable<MarketProfile["qualifiedDiscounts"]>;

export const QUALIFIED_DISCOUNT_LIMITS = { idNumber: 40, holderName: 120 } as const;

/** What the editor sends: an empty kind means no qualified discount. */
export type RawQualifiedDiscount = { kind: string; idNumber: string; holderName: string };

export const EMPTY_QUALIFIED_DISCOUNT: RawQualifiedDiscount = { kind: "", idNumber: "", holderName: "" };

/** Kept with the bill, so later changes to the market's rates never alter it. */
export type QualifiedDiscountSnapshot = {
  kind: string;
  label: string;
  idLabel: string;
  idNumber: string;
  holderName: string;
  rateBps: number;
  taxExempt: boolean;
};

export type QualifiedDiscountResult =
  | { ok: true; discount: QualifiedDiscountSnapshot | null }
  | { ok: false; errors: Record<string, string> };

const rawSchema = z.object({
  kind: z.string().catch(""),
  idNumber: z.string().catch(""),
  holderName: z.string().catch(""),
});

/** Error keys, as the editor shows them next to each field. */
export const QUALIFIED_DISCOUNT_FIELDS = {
  kind: "qualifiedDiscount.kind",
  idNumber: "qualifiedDiscount.idNumber",
  holderName: "qualifiedDiscount.holderName",
} as const;

export function parseQualifiedDiscount(
  input: unknown,
  config: QualifiedDiscountConfig | null,
  { hasLineDiscounts }: { hasLineDiscounts: boolean },
): QualifiedDiscountResult {
  const raw = rawSchema.safeParse(input ?? EMPTY_QUALIFIED_DISCOUNT);
  const value = raw.success ? raw.data : EMPTY_QUALIFIED_DISCOUNT;
  const code = value.kind.trim();
  if (code === "") return { ok: true, discount: null };

  const errors: Record<string, string> = {};
  const kind = config?.kinds.find((k) => k.code === code);
  if (!kind) {
    errors[QUALIFIED_DISCOUNT_FIELDS.kind] = "Choose a discount from the list.";
    return { ok: false, errors };
  }
  // RA 9994 Sec. 4 and its kin: the buyer gets the higher of a promo and the
  // qualified discount, never both.
  if (hasLineDiscounts) errors[QUALIFIED_DISCOUNT_FIELDS.kind] = config!.notWithLineDiscounts;

  const idNumber = value.idNumber.trim();
  if (idNumber === "") errors[QUALIFIED_DISCOUNT_FIELDS.idNumber] = `Enter the ${kind.idLabel}`;
  else if (idNumber.length > QUALIFIED_DISCOUNT_LIMITS.idNumber) errors[QUALIFIED_DISCOUNT_FIELDS.idNumber] = tooLong(QUALIFIED_DISCOUNT_LIMITS.idNumber);

  const holderName = value.holderName.trim();
  if (holderName === "") errors[QUALIFIED_DISCOUNT_FIELDS.holderName] = "Enter the name on the ID.";
  else if (holderName.length > QUALIFIED_DISCOUNT_LIMITS.holderName) {
    errors[QUALIFIED_DISCOUNT_FIELDS.holderName] = tooLong(QUALIFIED_DISCOUNT_LIMITS.holderName);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    discount: {
      kind: kind.code,
      label: kind.label,
      idLabel: kind.idLabel,
      idNumber,
      holderName,
      rateBps: kind.rateBps,
      taxExempt: kind.taxExempt,
    },
  };
}

/** The engine's input for a bill's qualified discount. */
export function qualifiedDiscountInput(discount: Pick<QualifiedDiscountSnapshot, "rateBps" | "taxExempt"> | null): QualifiedDiscountInput | null {
  return discount ? { rateBps: discount.rateBps, taxExempt: discount.taxExempt } : null;
}

/** A saved bill's qualified discount back into the editor's fields. */
export function toRawQualifiedDiscount(discount: QualifiedDiscountSnapshot | null): RawQualifiedDiscount {
  return discount ? { kind: discount.kind, idNumber: discount.idNumber, holderName: discount.holderName } : EMPTY_QUALIFIED_DISCOUNT;
}

/**
 * The printed breakdown (B.18.b), in minor units: the sale with its tax, the
 * tax taken out, the amount before tax, the discount, the tax added back
 * (none on a tax-exempt sale) and what's due. Every figure comes from the
 * engine's totals, so the rows always add up to the bill's total.
 */
export function qualifiedDiscountRows(
  amounts: Pick<DocumentAmounts, "totalMinor" | "taxTotalMinor" | "qualifiedDiscountTotalMinor" | "taxWaivedTotalMinor">,
  discount: Pick<QualifiedDiscountSnapshot, "label">,
  rows: QualifiedDiscountConfig["rows"],
  rate: string,
): { label: string; amountMinor: number; emphasis?: boolean; deduction?: boolean }[] {
  const taxBefore = amounts.taxWaivedTotalMinor + amounts.taxTotalMinor;
  const totalSales = amounts.totalMinor + amounts.qualifiedDiscountTotalMinor + amounts.taxWaivedTotalMinor;
  return [
    { label: rows.totalSales, amountMinor: totalSales },
    { label: rows.lessTax, amountMinor: taxBefore, deduction: true },
    { label: rows.netOfTax, amountMinor: totalSales - taxBefore },
    {
      label: rows.lessDiscount.replace("{label}", discount.label).replace("{rate}", rate),
      amountMinor: amounts.qualifiedDiscountTotalMinor,
      deduction: true,
    },
    { label: rows.addTax, amountMinor: amounts.taxTotalMinor },
    { label: rows.totalDue, amountMinor: amounts.totalMinor, emphasis: true },
  ];
}
