import { invoiceStatusPresentation } from "@/components/status/presentation";
import type { MarketProfile } from "@/config/markets";
import type { InvoiceStatus } from "@/modules/invoices";
import type { Quarter, WithholdingCsvRow } from "@/modules/payments";
import { daysOverdue, type PaymentRow, type SalesRow, toCsv, type UnpaidRow } from "@/modules/reports";
import type { CalendarDate } from "@/shared/dates/calendar";
import { minorToDecimalString } from "@/shared/money";

// The CSV downloads behind each report (2.2c, D18): one row per bill or
// payment, money as exact decimals, column names in the market's words.

type Market = Pick<MarketProfile, "taxId" | "paymentMethodLabels" | "taxWithheld" | "invoiceRegistration" | "qualifiedDiscounts">;
/** How the business's sales break down on its registered invoices: decides the extra VAT columns. */
export type SellerSales = "vat" | "percentage_tax" | "exempt" | null;

const money = (minor: number, currency: string) => minorToDecimalString(minor, currency);
const statusLabel = (status: string) => invoiceStatusPresentation[status as InvoiceStatus]?.label ?? status;

export function salesCsv(rows: readonly SalesRow[], market: Market, seller: SellerSales): string {
  const sales = seller === "vat" ? market.invoiceRegistration?.sales : undefined;
  const header = [
    "Date issued",
    "Number",
    "Document",
    "Customer",
    `Customer ${market.taxId.label}`,
    "Status",
    "Currency",
    "Before tax",
    "Tax",
    "Total",
    "Paid",
    "Balance",
    ...(sales ? [sales.vatable, sales.vat, sales.zeroRated, sales.exempt] : []),
    // Qualified buyers' discounts (D19), for the accountant's discount records.
    ...(market.qualifiedDiscounts ? ["Special discount"] : []),
  ];
  return toCsv([
    header,
    ...rows.map((r) => [
      r.issueDate,
      r.number,
      r.title,
      r.customerName,
      r.customerTaxId,
      statusLabel(r.status),
      r.currency,
      money(r.totalMinor - r.taxMinor, r.currency),
      money(r.taxMinor, r.currency),
      money(r.totalMinor, r.currency),
      money(r.paidMinor, r.currency),
      money(r.cancelled ? 0 : r.totalMinor - r.paidMinor, r.currency),
      ...(sales
        ? [r.vatableMinor, r.vatMinor, r.zeroRatedMinor, r.exemptMinor].map((m) => money(m, r.currency))
        : []),
      ...(market.qualifiedDiscounts ? [money(r.qualifiedDiscountMinor, r.currency)] : []),
    ]),
  ]);
}

export function paymentsCsv(rows: readonly PaymentRow[], market: Market): string {
  const withheld = market.taxWithheld;
  return toCsv([
    [
      "Date paid",
      "Receipt",
      "Bill",
      "Customer",
      `Customer ${market.taxId.label}`,
      "Method",
      "Reference",
      "Bank or wallet",
      "Paid by",
      "Time paid",
      "Date on cheque",
      "Currency",
      "Received",
      ...(withheld ? [withheld.label] : []),
    ],
    ...rows.map((r) => [
      r.paidOn,
      r.receiptNumber,
      r.invoiceNumber,
      r.customerName,
      r.customerTaxId,
      market.paymentMethodLabels[r.method as keyof Market["paymentMethodLabels"]] ?? r.method,
      r.reference,
      r.institution,
      r.payerName,
      r.paidTime,
      r.chequeDate,
      r.currency,
      money(r.amountMinor, r.currency),
      ...(withheld ? [money(r.withheldMinor, r.currency)] : []),
    ]),
  ]);
}

export function unpaidCsv(rows: readonly UnpaidRow[], today: CalendarDate): string {
  return toCsv([
    ["Number", "Document", "Customer", "Date issued", "Due date", "Days overdue", "Currency", "Total", "Paid", "Balance"],
    ...rows.map((r) => [
      r.number,
      r.title,
      r.customerName,
      r.issueDate,
      r.dueDate,
      daysOverdue(r.dueDate, today),
      r.currency,
      money(r.totalMinor, r.currency),
      money(r.paidMinor, r.currency),
      money(r.totalMinor - r.paidMinor, r.currency),
    ]),
  ]);
}

/** The 2307 report (spec section 8): one row per certificate row, then one per payment still waiting for its certificate. */
export function withholdingCsv(rows: readonly WithholdingCsvRow[], market: Market, { year, quarter }: { year: number; quarter: Quarter }): string {
  const label = `Q${quarter} ${year}`;
  const optionalMoney = (minor: number | null, currency: string) => (minor === null ? null : money(minor, currency));
  return toCsv([
    [
      "Quarter",
      "Status",
      `Payor ${market.taxId.label}`,
      "Payor name",
      "Received on",
      "ATC",
      "Rate %",
      "Month 1",
      "Month 2",
      "Month 3",
      "Total income payments",
      "Tax withheld",
      "Billing statements",
      "Has scan",
      "Currency",
    ],
    ...rows.map((r) => [
      label,
      r.status,
      r.payorTin,
      r.payorName,
      r.receivedOn,
      r.atcCode,
      r.rateBps === null ? null : (r.rateBps / 100).toFixed(2),
      optionalMoney(r.monthMinor?.[0] ?? null, r.currency),
      optionalMoney(r.monthMinor?.[1] ?? null, r.currency),
      optionalMoney(r.monthMinor?.[2] ?? null, r.currency),
      optionalMoney(r.totalMinor, r.currency),
      money(r.taxWithheldMinor, r.currency),
      r.billingStatements,
      r.hasScan === null ? null : r.hasScan ? "Yes" : "No",
      r.currency,
    ]),
  ]);
}
