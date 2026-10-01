import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { DocumentPaper } from "@/components/document/document-paper";
import { letterhead } from "@/components/document/letterhead";
import { MoneyAmount } from "@/components/money-amount";
import {
  LINK_UNAVAILABLE,
  PORTAL_RATE_LIMIT,
  PortalUnavailable,
  TOO_MANY_REQUESTS,
} from "@/components/portal/portal-unavailable";
import { StatusBadge } from "@/components/status/status-badge";
import { Wordmark } from "@/components/brand/wordmark";
import { marketFor } from "@/config/markets";
import { readLogoForSharedDocument } from "@/modules/files";
import { getCurrentSession } from "@/modules/identity";
import { getSharedInvoice, recordSharedInvoiceOpen } from "@/modules/invoices";
import { resolveMembership } from "@/modules/organizations";
import { listPaymentsForSharedInvoice } from "@/modules/payments";
import { consumeRateLimit } from "@/modules/system";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { formatMoney } from "@/shared/money";
import { clientIp } from "@/shared/http/client-ip";
import { invoiceDocumentView } from "../../(app)/invoices/_lib/invoice-view";

// The customer's view of an invoice, opened from its link (§G.4): the balance
// due up front, with the business's payment instructions beside it. No
// account, no third-party scripts; the portal headers keep the token out of
// referrers, caches and search engines (§I). Payments received are listed.

const loadInvoice = cache(async (token: string) => getSharedInvoice(token));

export async function generateMetadata({ params }: PageProps<"/i/[token]">): Promise<Metadata> {
  const shared = await loadInvoice((await params).token);
  const robots = { index: false, follow: false };
  if (!shared) return { title: "Link not available", robots };
  const market = marketFor(shared.countryCode);
  return {
    title: `${market.documents.invoice.singular} ${shared.invoice.number ?? ""} from ${shared.business.name}`,
    robots,
  };
}

export default async function SharedInvoicePage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const limit = await consumeRateLimit(`portal:${clientIp(await headers())}`, PORTAL_RATE_LIMIT);
  if (!limit.allowed) return <PortalUnavailable {...TOO_MANY_REQUESTS} />;

  const shared = await loadInvoice(token);
  // Unknown, revoked and expired links look the same: nothing to learn from probing.
  if (!shared) return <PortalUnavailable {...LINK_UNAVAILABLE} />;

  // The business opening its own link never counts as the customer's view.
  const session = await getCurrentSession();
  const membership = session ? await resolveMembership(session.user.id, shared.organizationId) : null;
  if (membership?.organizationId !== shared.organizationId) await recordSharedInvoiceOpen(token);

  const market = marketFor(shared.countryCode);
  const logo = await readLogoForSharedDocument(shared.organizationId);
  const { invoice, business } = shared;
  const view = invoiceDocumentView(invoice, {
    business: letterhead(
      business,
      market,
      logo ? { src: `/i/${token}/logo`, width: logo.width, height: logo.height } : null,
    ),
    market,
    locale: shared.locale,
  });
  const contact = [business.email, business.phone].filter(Boolean).join(" · ");
  const balanceMinor = invoice.totalMinor - invoice.amountPaidMinor;
  const closed = invoice.status === "VOID" || invoice.status === "CANCELLED";
  const received = closed ? [] : await listPaymentsForSharedInvoice(shared.organizationId, invoice.id);
  // A sent invoice edited before payment keeps its link; say so (D7).
  const updatedOn = invoice.editedAt
    ? new Intl.DateTimeFormat(shared.locale, { dateStyle: "long", timeZone: business.timezone }).format(invoice.editedAt)
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sm font-normal text-muted-foreground">
          {market.documents.invoice.singular} from <span className="font-medium text-foreground">{business.name}</span>
        </h1>
        <StatusBadge kind="invoice" status={invoice.status} />
      </header>

      {!closed && invoice.status !== "PAID" && (
        <section
          aria-label="Balance due"
          className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8"
        >
          <div>
            <p className="text-sm text-muted-foreground">Balance due</p>
            <MoneyAmount
              amountMinor={balanceMinor}
              currency={invoice.currency}
              locale={shared.locale}
              className="text-3xl font-semibold"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Due {formatCalendarDate(invoice.dueDate, shared.locale)}
            </p>
          </div>
          <div className="min-w-0 text-sm">
            <p className="font-medium">How to pay</p>
            {invoice.paymentInstructions ? (
              <p className="mt-1 whitespace-pre-wrap">{invoice.paymentInstructions}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Contact {business.name}
                {contact ? ` (${contact})` : ""} for payment details.
              </p>
            )}
          </div>
        </section>
      )}
      {invoice.status === "PAID" && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-xs">
          Paid in full. Thank you!
        </p>
      )}
      {closed && (
        <p className="mb-4 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
          {business.name} {invoice.status === "VOID" ? "voided" : "cancelled"} this{" "}
          {market.documents.invoice.singular.toLowerCase()}. Nothing is owed on it. Contact them if you have questions.
        </p>
      )}

      {updatedOn && !closed && (
        <p className="mb-4 text-sm text-muted-foreground">
          Updated {updatedOn}. This is the latest version.
        </p>
      )}

      {received.length > 0 && (
        <section aria-label="Payments received" className="mb-6 rounded-xl border border-border bg-card p-5 text-sm shadow-xs">
          <p className="font-medium">Payments received</p>
          <ul className="mt-2 divide-y divide-border">
            {received.map((payment) => (
              <li key={payment.receiptNumber} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-muted-foreground">
                  {formatCalendarDate(payment.paidOn, shared.locale)} · {market.paymentMethodLabels[payment.method]} ·{" "}
                  {market.documents.receipt.singular} {payment.receiptNumber}
                  {payment.withheldMinor > 0 && market.taxWithheld
                    ? ` · ${market.taxWithheld.label} ${formatMoney(payment.withheldMinor, payment.currency, { locale: shared.locale })}`
                    : ""}
                </span>
                <MoneyAmount amountMinor={payment.amountMinor} currency={payment.currency} locale={shared.locale} className="font-medium" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <DocumentPaper view={view} />

      <footer className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        Sent with <Wordmark size={12} />
      </footer>
    </main>
  );
}
