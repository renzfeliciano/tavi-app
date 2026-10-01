import type { Route } from "next";
import type { MarketProfile } from "@/config/markets";

// The audit log as the dashboard's "Recent activity" (§G.2): the business
// events people care about, in plain words and the market's document names.
// Everything else in the log (sign-ins, settings, links) is left out here.

export type ActivityEvent = {
  action: string;
  actorType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
};

export type Activity = { text: string; href: Route | null };

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

export function describeActivity(event: ActivityEvent, market: Pick<MarketProfile, "documents">): Activity | null {
  const m = event.metadata ?? {};
  const quote = `${market.documents.quote.singular} ${str(m.number) ?? ""}`.trim();
  const invoice = (number: unknown) => `${market.documents.invoice.singular} ${str(number) ?? ""}`.trim();
  const at = (path: string): Route | null => (event.entityId ? (`${path}/${event.entityId}` as Route) : null);

  switch (event.action) {
    case "quote.sent":
      return { text: `${quote} sent`, href: at("/quotes") };
    case "quote.viewed":
      return { text: `Customer opened ${quote}`, href: at("/quotes") };
    case "quote.approved":
      return { text: `${str(m.name) ?? "Customer"} approved ${quote}`, href: at("/quotes") };
    case "quote.rejected":
      return { text: `Customer declined ${quote}`, href: at("/quotes") };
    case "quote.expired":
      return { text: `${quote} expired`, href: at("/quotes") };
    case "quote.cancelled":
      return { text: `${quote} cancelled`, href: at("/quotes") };
    case "invoice.sent":
      return { text: `${invoice(m.number)} sent`, href: at("/invoices") };
    case "invoice.viewed":
      return { text: `Customer opened ${invoice(m.number)}`, href: at("/invoices") };
    case "invoice.edited":
      return { text: `${invoice(m.number)} updated`, href: at("/invoices") };
    case "invoice.voided":
      return { text: `${invoice(m.number)} voided`, href: at("/invoices") };
    case "invoice.cancelled":
      return { text: `${invoice(m.number)} cancelled`, href: at("/invoices") };
    case "payment.recorded":
      return { text: `Payment ${str(m.receiptNumber) ?? ""} recorded on ${invoice(m.invoiceNumber)}`, href: at("/payments") };
    case "payment.voided":
      return { text: `Payment ${str(m.receiptNumber) ?? ""} voided on ${invoice(m.invoiceNumber)}`, href: at("/payments") };
    default:
      return null;
  }
}
