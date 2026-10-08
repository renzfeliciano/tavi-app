import type { CalendarDate } from "@/shared/dates/calendar";
import { AGING_BUCKETS, type AgingBucket, agingBucket, daysOverdue } from "./aging";

// Report figures (2.2, D18), worked out from the plain rows the invoices and
// payments modules return. Every total is per currency, never summed across
// currencies (§B.2), and the summaries come sorted by currency code.

/** A bill issued in the period. Void bills never come here: they never happened (D6). */
export type SalesRow = {
  id: string;
  number: string;
  /** As issued: the market's name for a bill, or the registered invoice's title. */
  title: string;
  registered: boolean;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  status: string;
  /** Called off after it was issued: cancelled revenue, not sales (D6). */
  cancelled: boolean;
  customerId: string | null;
  customerName: string | null;
  customerTaxId: string | null;
  currency: string;
  totalMinor: number;
  taxMinor: number;
  paidMinor: number;
  /**
   * Its lines by tax treatment (the invoices module's `salesBreakdown` rule),
   * before any qualified discount; less that discount, they make the total.
   */
  vatableMinor: number;
  vatMinor: number;
  zeroRatedMinor: number;
  exemptMinor: number;
  /** A qualified buyer's discount (D19; PH: senior citizen, PWD, …), 0 without one. */
  qualifiedDiscountMinor: number;
};

export type SalesSummary = {
  currency: string;
  issued: { count: number; totalMinor: number; netMinor: number; taxMinor: number };
  /** Of those issued, the registered invoices (invoice mode, D13). */
  registered: { count: number; totalMinor: number };
  cancelled: { count: number; totalMinor: number };
  breakdown: { vatableMinor: number; vatMinor: number; zeroRatedMinor: number; exemptMinor: number; qualifiedDiscountMinor: number };
};

/** An active payment received in the period; voided payments never count. */
export type PaymentRow = {
  receiptNumber: string;
  paidOn: CalendarDate;
  method: string;
  reference: string | null;
  currency: string;
  /** Money received. */
  amountMinor: number;
  /** Tax the customer withheld and pays to the tax authority for the business (PH: Form 2307). */
  withheldMinor: number;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerTaxId: string | null;
};

export type PaymentsSummary = {
  currency: string;
  count: number;
  receivedMinor: number;
  withheldMinor: number;
  byMethod: { method: string; count: number; receivedMinor: number }[];
  /** Who withheld tax, to match against the certificates they hand over (PH: Form 2307). */
  withheldByCustomer: { customerName: string | null; customerTaxId: string | null; count: number; withheldMinor: number }[];
};

/** A sent bill that isn't settled yet. */
export type UnpaidRow = {
  id: string;
  number: string;
  title: string;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  status: string;
  customerId: string | null;
  customerName: string | null;
  currency: string;
  totalMinor: number;
  paidMinor: number;
};

export type UnpaidSummary = {
  currency: string;
  count: number;
  outstandingMinor: number;
  buckets: Record<AgingBucket, number>;
  byCustomer: {
    customerName: string | null;
    count: number;
    outstandingMinor: number;
    oldestDueDate: CalendarDate;
    daysOverdue: number;
  }[];
};

/** Folds rows into one accumulator per currency, in currency-code order. */
function perCurrency<Row extends { currency: string }, Acc>(
  rows: readonly Row[],
  start: (currency: string) => Acc,
  add: (acc: Acc, row: Row) => void,
): Acc[] {
  const accs = new Map<string, Acc>();
  for (const row of rows) {
    let acc = accs.get(row.currency);
    if (acc === undefined) {
      acc = start(row.currency);
      accs.set(row.currency, acc);
    }
    add(acc, row);
  }
  return [...accs.keys()].sort().map((currency) => accs.get(currency) as Acc);
}

/** Customers are grouped by their record, or by name for bills without one; the first row's name shows. */
const customerKey = (row: { customerId: string | null; customerName: string | null }) =>
  row.customerId ?? `name:${row.customerName ?? ""}`;

const byName = (a: { customerName: string | null }, b: { customerName: string | null }) =>
  (a.customerName ?? "").localeCompare(b.customerName ?? "");

export function summarizeSales(rows: readonly SalesRow[]): SalesSummary[] {
  return perCurrency(
    rows,
    (currency): SalesSummary => ({
      currency,
      issued: { count: 0, totalMinor: 0, netMinor: 0, taxMinor: 0 },
      registered: { count: 0, totalMinor: 0 },
      cancelled: { count: 0, totalMinor: 0 },
      breakdown: { vatableMinor: 0, vatMinor: 0, zeroRatedMinor: 0, exemptMinor: 0, qualifiedDiscountMinor: 0 },
    }),
    (summary, row) => {
      if (row.cancelled) {
        summary.cancelled.count += 1;
        summary.cancelled.totalMinor += row.totalMinor;
        return;
      }
      summary.issued.count += 1;
      summary.issued.totalMinor += row.totalMinor;
      summary.issued.taxMinor += row.taxMinor;
      summary.issued.netMinor += row.totalMinor - row.taxMinor;
      if (row.registered) {
        summary.registered.count += 1;
        summary.registered.totalMinor += row.totalMinor;
      }
      summary.breakdown.vatableMinor += row.vatableMinor;
      summary.breakdown.vatMinor += row.vatMinor;
      summary.breakdown.zeroRatedMinor += row.zeroRatedMinor;
      summary.breakdown.exemptMinor += row.exemptMinor;
      summary.breakdown.qualifiedDiscountMinor += row.qualifiedDiscountMinor;
    },
  );
}

export function summarizePayments(rows: readonly PaymentRow[]): PaymentsSummary[] {
  type Acc = {
    summary: PaymentsSummary;
    methods: Map<string, PaymentsSummary["byMethod"][number]>;
    customers: Map<string, PaymentsSummary["withheldByCustomer"][number]>;
  };
  const accs = perCurrency(
    rows,
    (currency): Acc => ({
      summary: { currency, count: 0, receivedMinor: 0, withheldMinor: 0, byMethod: [], withheldByCustomer: [] },
      methods: new Map(),
      customers: new Map(),
    }),
    ({ summary, methods, customers }, row) => {
      summary.count += 1;
      summary.receivedMinor += row.amountMinor;
      summary.withheldMinor += row.withheldMinor;
      const method = methods.get(row.method) ?? { method: row.method, count: 0, receivedMinor: 0 };
      method.count += 1;
      method.receivedMinor += row.amountMinor;
      methods.set(row.method, method);
      if (row.withheldMinor > 0) {
        const key = customerKey(row);
        const customer = customers.get(key) ?? {
          customerName: row.customerName,
          customerTaxId: row.customerTaxId,
          count: 0,
          withheldMinor: 0,
        };
        customer.count += 1;
        customer.withheldMinor += row.withheldMinor;
        customers.set(key, customer);
      }
    },
  );
  return accs.map(({ summary, methods, customers }) => ({
    ...summary,
    byMethod: [...methods.values()].sort((a, b) => b.receivedMinor - a.receivedMinor || a.method.localeCompare(b.method)),
    withheldByCustomer: [...customers.values()].sort((a, b) => b.withheldMinor - a.withheldMinor || byName(a, b)),
  }));
}

export function summarizeUnpaid(rows: readonly UnpaidRow[], today: CalendarDate): UnpaidSummary[] {
  type Customer = UnpaidSummary["byCustomer"][number];
  type Acc = { summary: UnpaidSummary; customers: Map<string, Customer> };
  const owing = rows.filter((row) => row.totalMinor - row.paidMinor > 0);
  const accs = perCurrency(
    owing,
    (currency): Acc => ({
      summary: {
        currency,
        count: 0,
        outstandingMinor: 0,
        buckets: Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket.key, 0])) as Record<AgingBucket, number>,
        byCustomer: [],
      },
      customers: new Map(),
    }),
    ({ summary, customers }, row) => {
      const balance = row.totalMinor - row.paidMinor;
      summary.count += 1;
      summary.outstandingMinor += balance;
      summary.buckets[agingBucket(row.dueDate, today)] += balance;
      const key = customerKey(row);
      const customer = customers.get(key) ?? {
        customerName: row.customerName,
        count: 0,
        outstandingMinor: 0,
        oldestDueDate: row.dueDate,
        daysOverdue: 0,
      };
      customer.count += 1;
      customer.outstandingMinor += balance;
      if (row.dueDate < customer.oldestDueDate) customer.oldestDueDate = row.dueDate;
      customer.daysOverdue = daysOverdue(customer.oldestDueDate, today);
      customers.set(key, customer);
    },
  );
  return accs.map(({ summary, customers }) => ({
    ...summary,
    byCustomer: [...customers.values()].sort((a, b) => b.outstandingMinor - a.outstandingMinor || byName(a, b)),
  }));
}
