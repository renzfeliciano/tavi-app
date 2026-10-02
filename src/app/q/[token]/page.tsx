import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { DocumentPaper } from "@/components/document/document-paper";
import {
  LINK_UNAVAILABLE,
  PORTAL_RATE_LIMIT,
  PortalUnavailable,
  TOO_MANY_REQUESTS,
} from "@/components/portal/portal-unavailable";
import { letterhead } from "@/components/document/letterhead";
import { StatusBadge } from "@/components/status/status-badge";
import { Wordmark } from "@/components/brand/wordmark";
import { LegalLinks } from "@/components/legal/legal-document";
import { marketFor } from "@/config/markets";
import { readLogoForSharedDocument } from "@/modules/files";
import { getCurrentSession } from "@/modules/identity";
import { resolveMembership } from "@/modules/organizations";
import { getSharedQuote, recordSharedQuoteOpen, sharedQuoteContentHash } from "@/modules/quotes";
import { consumeRateLimit } from "@/modules/system";
import { formatCalendarDate } from "@/shared/dates/calendar";
import { clientIp } from "@/shared/http/client-ip";
import { quoteDocumentView } from "../../(app)/quotes/_lib/quote-view";
import { QuoteDecision } from "./quote-decision";

// The customer's view of a quote, opened from its link (§G.4). No account,
// no third-party scripts; the portal headers keep the token out of referrers,
// caches and search engines (§I). The customer approves or declines here, and
// their first open marks the quote VIEWED (§B.3).

const loadQuote = cache(async (token: string) => getSharedQuote(token));

export async function generateMetadata({ params }: PageProps<"/q/[token]">): Promise<Metadata> {
  const shared = await loadQuote((await params).token);
  const robots = { index: false, follow: false };
  if (!shared) return { title: "Link not available", robots };
  const market = marketFor(shared.countryCode);
  return {
    title: `${market.documents.quote.singular} ${shared.quote.number ?? ""} from ${shared.business.name}`.replace("  ", " "),
    robots,
  };
}

export default async function SharedQuotePage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  const limit = await consumeRateLimit(`portal:${clientIp(await headers())}`, PORTAL_RATE_LIMIT);
  if (!limit.allowed) {
    return <PortalUnavailable {...TOO_MANY_REQUESTS} />;
  }

  const shared = await loadQuote(token);
  if (!shared) {
    // Unknown, revoked and expired links look the same: nothing to learn from probing.
    return <PortalUnavailable {...LINK_UNAVAILABLE} />;
  }
  // The business opening its own link never counts as the customer's view (§B.3).
  const session = await getCurrentSession();
  const membership = session ? await resolveMembership(session.user.id, shared.organizationId) : null;
  if (membership?.organizationId !== shared.organizationId) await recordSharedQuoteOpen(token);

  const market = marketFor(shared.countryCode);
  const logo = await readLogoForSharedDocument(shared.organizationId);
  const view = quoteDocumentView(shared.quote, {
    business: letterhead(
      shared.business,
      market,
      logo ? { src: `/q/${token}/logo`, width: logo.width, height: logo.height } : null,
    ),
    market,
    locale: shared.locale,
  });
  const { quote, business } = shared;
  const contact = [business.email, business.phone].filter(Boolean).join(" · ");
  const name = `${market.documents.quote.singular} ${quote.number ?? ""}`.trim();
  const open = quote.status === "SENT" || quote.status === "VIEWED";
  const decidedOn = quote.decidedAt
    ? new Intl.DateTimeFormat(shared.locale, { dateStyle: "long", timeZone: business.timezone }).format(quote.decidedAt)
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sm font-normal text-muted-foreground">
          {market.documents.quote.singular} from <span className="font-medium text-foreground">{business.name}</span>
        </h1>
        <div className="flex items-center gap-3">
          <StatusBadge kind="quote" status={quote.status} />
          <a href={`/q/${token}/pdf`} download className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Download PDF
          </a>
        </div>
      </header>

      {open && (
        <p className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-pretty shadow-xs">
          This quote is valid until{" "}
          <span className="font-medium">{formatCalendarDate(quote.validUntil, shared.locale)}</span>. Approve it below
          to go ahead, or contact {business.name}
          {contact ? ` (${contact})` : ""} with questions.
        </p>
      )}
      {quote.status === "APPROVED" && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-pretty shadow-xs">
          {quote.decisionName ? `Approved by ${quote.decisionName}` : "Approved"}
          {decidedOn ? ` on ${decidedOn}` : ""}. {business.name} has been told
          {contact ? ` and will be in touch (${contact})` : " and will be in touch"}.
        </p>
      )}
      {quote.status === "REJECTED" && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
          You declined this quote{decidedOn ? ` on ${decidedOn}` : ""}. {business.name} has been told.
        </p>
      )}
      {quote.status === "EXPIRED" && (
        <p className="mb-4 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
          This quote expired on {formatCalendarDate(quote.validUntil, shared.locale)}. Ask {business.name}
          {contact ? ` (${contact})` : ""} for an updated quote.
        </p>
      )}
      {quote.status === "CANCELLED" && (
        <p className="mb-4 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
          {business.name} cancelled this quote. Contact them if you have questions.
        </p>
      )}

      <DocumentPaper view={view} />

      {open && (
        <QuoteDecision
          token={token}
          contentHash={sharedQuoteContentHash(quote)}
          name={name}
          businessName={business.name}
        />
      )}

      <footer className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        Sent with <Wordmark size={12} />
      </footer>
      <LegalLinks className="mt-2" />
    </main>
  );
}
