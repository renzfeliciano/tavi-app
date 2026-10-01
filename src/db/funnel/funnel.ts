// The product funnel (proposal §K, §48; tavi-product "Funnel" and "Validation"):
// how far each beta business has got along the critical path, read from the
// `business_funnel` view (migration 0018). No analytics SDK; nothing on the
// customer pages. It reads only, and prints business names, never customers.
//
//   FUNNEL_DATABASE_URL=<production, direct> npm run funnel
//
// Self-contained (only `pg` and Node), like the restore check.
import pg from "pg";

export const FUNNEL_STEPS = [
  { key: "organizationCreatedAt", label: "Business created" },
  { key: "firstCustomerAt", label: "First customer" },
  { key: "firstQuoteAt", label: "First quote" },
  { key: "firstQuoteSentAt", label: "First quote sent" },
  { key: "firstApprovalAt", label: "First approval" },
  { key: "firstInvoiceAt", label: "First bill" },
  { key: "firstInvoiceSentAt", label: "First bill sent" },
  { key: "firstPaymentAt", label: "First payment" },
] as const;

type StepKey = (typeof FUNNEL_STEPS)[number]["key"];

export type FunnelRow = { organizationId: string; businessName: string; lastActiveAt: Date | null } & Record<StepKey, Date | null>;

export type FunnelSummary = {
  total: number;
  steps: { key: StepKey; label: string; reached: number }[];
  /** The north-star activation metric: business created → first sent quote, in minutes. */
  medianMinutesToFirstSentQuote: number | null;
  businesses: { name: string; furthestStep: string; lastActiveAt: Date | null }[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function summarizeFunnel(rows: FunnelRow[]): FunnelSummary {
  const steps = FUNNEL_STEPS.map((step) => ({ ...step, reached: rows.filter((r) => r[step.key] !== null).length }));
  const minutes = rows.flatMap((r) =>
    r.firstQuoteSentAt && r.organizationCreatedAt
      ? [(r.firstQuoteSentAt.getTime() - r.organizationCreatedAt.getTime()) / 60_000]
      : [],
  );
  const businesses = rows.map((r) => {
    const furthest = [...FUNNEL_STEPS].reverse().find((step) => r[step.key] !== null);
    return { name: r.businessName, furthestStep: furthest?.label ?? FUNNEL_STEPS[0].label, lastActiveAt: r.lastActiveAt };
  });
  return { total: rows.length, steps, medianMinutesToFirstSentQuote: median(minutes), businesses };
}

const describeMinutes = (m: number) => (m < 90 ? `${Math.round(m)} min` : m < 48 * 60 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} days`);

/** The summary as plain text for the terminal. */
export function formatFunnel(summary: FunnelSummary): string {
  const pct = (n: number) => (summary.total === 0 ? "0%" : `${Math.round((n / summary.total) * 100)}%`);
  const lines = summary.steps.map((s) => `${s.label.padEnd(20)}${String(s.reached).padStart(3)}  ${pct(s.reached).padStart(4)}`);
  const m = summary.medianMinutesToFirstSentQuote;
  lines.push("", `Median time to first sent quote: ${m === null ? "no sent quotes yet" : describeMinutes(m)}`, "", "Furthest step per business:");
  for (const b of summary.businesses) {
    const active = b.lastActiveAt ? `last active ${b.lastActiveAt.toISOString().slice(0, 10)}` : "never active";
    lines.push(`  ${b.name}: ${b.furthestStep} (${active})`);
  }
  return lines.join("\n");
}

const COLUMNS = `organization_id, business_name, organization_created_at, first_customer_at, first_quote_at,
  first_quote_sent_at, first_approval_at, first_invoice_at, first_invoice_sent_at, first_payment_at, last_active_at`;

/** Every business's row from the view, oldest first. */
export async function readFunnel(client: { query: (text: string) => Promise<{ rows: Record<string, unknown>[] }> }): Promise<FunnelRow[]> {
  const { rows } = await client.query(`select ${COLUMNS} from business_funnel order by organization_created_at`);
  const date = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string));
  return rows.map((r) => ({
    organizationId: String(r.organization_id),
    businessName: String(r.business_name),
    organizationCreatedAt: date(r.organization_created_at),
    firstCustomerAt: date(r.first_customer_at),
    firstQuoteAt: date(r.first_quote_at),
    firstQuoteSentAt: date(r.first_quote_sent_at),
    firstApprovalAt: date(r.first_approval_at),
    firstInvoiceAt: date(r.first_invoice_at),
    firstInvoiceSentAt: date(r.first_invoice_sent_at),
    firstPaymentAt: date(r.first_payment_at),
    lastActiveAt: date(r.last_active_at),
  }));
}

if (process.argv[1]?.endsWith("funnel.ts")) {
  const url = process.env.FUNNEL_DATABASE_URL;
  if (!url) {
    console.error("Usage: FUNNEL_DATABASE_URL=… npm run funnel");
    process.exit(2);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    console.log(formatFunnel(summarizeFunnel(await readFunnel(client))));
  } finally {
    await client.end();
  }
}
