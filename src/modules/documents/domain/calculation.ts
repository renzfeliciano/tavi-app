import { QUANTITY_SCALE } from "./quantity";

// The one calculation function (docs/foundation-proposal.md §B.2). The editor
// preview, the PDF, the public portal and what's saved all call this, so they
// can never disagree. Pure: integers in, integers out.
//
//   lineGross    = round(unitPrice × qty)
//   lineDiscount = percent ? round(lineGross × bps / 10000) : min(fixed, lineGross)
//   lineNet      = lineGross − lineDiscount
//   lineTax      = exclusive ? round(lineNet × rate / 10000)
//                            : lineNet − round(lineNet × 10000 / (10000 + rate))
//   lineTotal    = exclusive ? lineNet + lineTax : lineNet
//
// A qualified discount (PH: senior citizens, PWDs, solo parents, national
// athletes and coaches, Medal of Valor awardees; RR 7-2024 Sec. 6 B.18, D19)
// applies to every line, on the price before tax:
//
//   lineTaxRegular = the lineTax above (what the sale would carry)
//   base           = exclusive ? lineNet : lineNet − lineTaxRegular
//   qualified      = round(base × rate / 10000)
//   taxExempt      → lineTax = 0, taxWaived = lineTaxRegular, lineTotal = base − qualified
//   otherwise      → lineTax = lineTaxRegular (on the undiscounted price), lineTotal = base + lineTax − qualified
//
// Rounding is half away from zero, per line; document totals are sums of the
// lines, so a customer can check every figure. Products are computed in BigInt
// (price × quantity can exceed 2^53 on the way) and every result must be a
// safe integer.

export type TaxMode = "inclusive" | "exclusive";

export type LineDiscount = { kind: "percent"; bps: number } | { kind: "amount"; amountMinor: number };
export type LineTax = { name: string; rateBps: number };

export type LineInput = {
  unitPriceMinor: number;
  /** Scaled by QUANTITY_SCALE (1.5 → 15000). */
  quantity: number;
  discount: LineDiscount | null;
  tax: LineTax | null;
};

/**
 * A discount the law grants a qualified buyer on the whole sale, and whether
 * the law also exempts that sale from tax (D19).
 */
export type QualifiedDiscountInput = { rateBps: number; taxExempt: boolean };

export type DocumentInput = {
  taxMode: TaxMode;
  lines: readonly LineInput[];
  qualifiedDiscount?: QualifiedDiscountInput | null;
};

export type LineAmounts = {
  grossMinor: number;
  discountMinor: number;
  /** grossMinor − discountMinor: the line's amount as priced, before any qualified discount. */
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  /** The qualified discount on this line (0 without one). */
  qualifiedDiscountMinor: number;
  /** Tax the line would have carried, waived by a tax-exempt qualified discount (0 otherwise). */
  taxWaivedMinor: number;
};

export type TaxGroup = {
  name: string;
  rateBps: number;
  /** The amount the tax is charged on (before tax, in both modes). */
  taxableMinor: number;
  taxMinor: number;
};

export type DocumentAmounts = {
  lines: LineAmounts[];
  subtotalMinor: number;
  discountTotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;
  qualifiedDiscountTotalMinor: number;
  taxWaivedTotalMinor: number;
  /** Tax per name and rate, in order of first use; tax-exempt sales carry none. */
  taxes: TaxGroup[];
};

const BPS = 10_000n;
const SCALE = BigInt(QUANTITY_SCALE);

/** n / d rounded half away from zero. */
export function roundDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new RangeError("Divisor must be positive");
  const negative = n < 0n;
  const magnitude = negative ? -n : n;
  const q = (2n * magnitude + d) / (2n * d);
  return negative ? -q : q;
}

function toSafe(value: bigint, what: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${what} is too large to calculate exactly`);
  }
  return Number(value);
}

function assertInteger(value: number, what: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${what} must be an integer from ${min} to ${max}; received ${value}`);
  }
}

function validate(line: LineInput) {
  assertInteger(line.unitPriceMinor, "Unit price", 0);
  assertInteger(line.quantity, "Quantity", 1);
  if (line.discount?.kind === "percent") assertInteger(line.discount.bps, "Discount", 0, 10_000);
  if (line.discount?.kind === "amount") assertInteger(line.discount.amountMinor, "Discount", 0);
  if (line.tax) assertInteger(line.tax.rateBps, "Tax rate", 0, 10_000);
}

function calculateLine(line: LineInput, taxMode: TaxMode, qualified: QualifiedDiscountInput | null): LineAmounts {
  validate(line);
  const gross = roundDiv(BigInt(line.unitPriceMinor) * BigInt(line.quantity), SCALE);

  let discount = 0n;
  if (line.discount?.kind === "percent") discount = roundDiv(gross * BigInt(line.discount.bps), BPS);
  if (line.discount?.kind === "amount") {
    const fixed = BigInt(line.discount.amountMinor);
    discount = fixed < gross ? fixed : gross;
  }
  const net = gross - discount;

  let tax = 0n;
  if (line.tax) {
    const rate = BigInt(line.tax.rateBps);
    tax = taxMode === "exclusive" ? roundDiv(net * rate, BPS) : net - roundDiv(net * BPS, BPS + rate);
  }
  let total = taxMode === "exclusive" ? net + tax : net;

  let qualifiedDiscount = 0n;
  let waived = 0n;
  if (qualified) {
    const base = taxMode === "exclusive" ? net : net - tax;
    qualifiedDiscount = roundDiv(base * BigInt(qualified.rateBps), BPS);
    if (qualified.taxExempt) {
      waived = tax;
      tax = 0n;
    }
    total = base + tax - qualifiedDiscount;
  }

  return {
    grossMinor: toSafe(gross, "A line amount"),
    discountMinor: toSafe(discount, "A discount"),
    netMinor: toSafe(net, "A line amount"),
    taxMinor: toSafe(tax, "A tax amount"),
    totalMinor: toSafe(total, "A line total"),
    qualifiedDiscountMinor: toSafe(qualifiedDiscount, "A discount"),
    taxWaivedMinor: toSafe(waived, "A tax amount"),
  };
}

export function calculateDocument({ taxMode, lines, qualifiedDiscount = null }: DocumentInput): DocumentAmounts {
  if (qualifiedDiscount) assertInteger(qualifiedDiscount.rateBps, "Qualified discount", 0, 10_000);
  const amounts = lines.map((line) => calculateLine(line, taxMode, qualifiedDiscount));

  const totals = { subtotal: 0n, discount: 0n, tax: 0n, total: 0n, qualified: 0n, waived: 0n };
  const groups = new Map<string, { name: string; rateBps: number; taxable: bigint; tax: bigint }>();
  amounts.forEach((a, i) => {
    totals.subtotal += BigInt(a.grossMinor);
    totals.discount += BigInt(a.discountMinor);
    totals.tax += BigInt(a.taxMinor);
    totals.total += BigInt(a.totalMinor);
    totals.qualified += BigInt(a.qualifiedDiscountMinor);
    totals.waived += BigInt(a.taxWaivedMinor);

    const tax = lines[i]?.tax;
    // A tax-exempt sale carries no tax, so it joins no group.
    if (!tax || qualifiedDiscount?.taxExempt) return;
    const key = `${tax.name}\u0000${tax.rateBps}`;
    const group = groups.get(key) ?? { name: tax.name, rateBps: tax.rateBps, taxable: 0n, tax: 0n };
    group.taxable += BigInt(taxMode === "exclusive" ? a.netMinor : a.netMinor - a.taxMinor);
    group.tax += BigInt(a.taxMinor);
    groups.set(key, group);
  });

  return {
    lines: amounts,
    subtotalMinor: toSafe(totals.subtotal, "The subtotal"),
    discountTotalMinor: toSafe(totals.discount, "The discount total"),
    taxTotalMinor: toSafe(totals.tax, "The tax total"),
    totalMinor: toSafe(totals.total, "The total"),
    qualifiedDiscountTotalMinor: toSafe(totals.qualified, "The discount total"),
    taxWaivedTotalMinor: toSafe(totals.waived, "The tax total"),
    taxes: [...groups.values()].map((g) => ({
      name: g.name,
      rateBps: g.rateBps,
      taxableMinor: toSafe(g.taxable, "A tax base"),
      taxMinor: toSafe(g.tax, "A tax amount"),
    })),
  };
}
