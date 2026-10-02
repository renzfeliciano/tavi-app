import { invoiceStatusPresentation } from "@/components/status/presentation";
import type { MarketProfile } from "@/config/markets";
import type { InvoiceStatus } from "@/modules/invoices";
import { daysOverdue, type PaymentRow, type SalesRow, toCsv, type UnpaidRow } from "@/modules/reports";
import type { CalendarDate } from "@/shared/dates/calendar";
import { minorToDecimalString } from "@/shared/money";

// The CSV downloads behind each report (2.2c, D18): one row per bill or
// payment, money as exact decimals, column names in the market's words.

type Market = Pick<MarketProfile, "taxId" | "paymentMethodLabels" | "taxWithheld" | "invoiceRegistration">;
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
