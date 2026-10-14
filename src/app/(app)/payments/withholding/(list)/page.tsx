import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2Icon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { listCertificates, listPendingByCustomer } from "@/modules/payments";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import {
  CertificateListSkeleton,
  certificateColumns,
  certificateSummaryLine,
  quarterLabel,
} from "../_components/certificate-list";
import { PendingListSkeleton, pendingColumns, pendingSummaryLine } from "../_components/pending-list";
import { matchesSearch, pageOf } from "../_lib/paging";

export const metadata: Metadata = { title: "Withholding certificates" };

const VIEWS = ["waiting", "received", "void"] as const;
type View = (typeof VIEWS)[number];
const isView = (value: unknown): value is View => VIEWS.includes(value as View);

// The tax customers withheld, and the certificates (PH: BIR Form 2307) they send for it: what is still
// owed, what has arrived, and what was voided. One list at a time, as every list in the app.
export default async function WithholdingPage({ searchParams }: PageProps<"/payments/withholding">) {
  const ctx = await requireOrgContext();
  const certificate = ctx.market.taxWithheld?.certificate;
  if (!certificate) notFound();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const requested = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: View = isView(requested) ? requested : "waiting";
  const canRecord = can(ctx, "payments.record");
  const pageSize = parsePageSize(params.size);
  const page = pageParam(params.page);

  const [waiting, received, voided] = await Promise.all([
    listPendingByCustomer(ctx),
    listCertificates(ctx, {}),
    listCertificates(ctx, { voided: true }),
  ]);
  const counts = { waiting: waiting.length, received: received.length, void: voided.length };

  const short = certificate.short;
  const description = `Tax your customers withheld, and the ${certificate.name} certificates they send for it.`;
  const header = (
    <PageHeader
      title={`Withholding (${short})`}
      description={description}
      actions={
        canRecord && (
          <Link href={"/payments/withholding/new" as Route} className={buttonVariants()}>
            <FilePlus2Icon aria-hidden="true" />
            Record a {short}
          </Link>
        )
      }
    />
  );

  if (counts.waiting + counts.received + counts.void === 0) {
    return (
      <>
        <BackLink href="/payments">Payments</BackLink>
        {header}
        <SectionEmpty
          title={`No ${short} certificates yet`}
          description={`When a customer withholds tax from a payment, they owe you a ${certificate.name}: the certificate that lets you claim that tax. Record the withholding on the payment, and it shows up here until the certificate arrives.`}
          action={canRecord ? { href: "/payments/withholding/new" as Route, label: `Record a ${short}`, icon: FilePlus2Icon } : undefined}
        />
      </>
    );
  }

  const href = (q: string | null, to: View) => listHref("/payments/withholding", { q, view: to === "waiting" ? null : to, size: sizeParam(pageSize) });
  const labels: Record<View, string> = { waiting: `Waiting for a ${short}`, received: "Received", void: "Void" };

  const waitingPage = pageOf(
    waiting.filter((group) => matchesSearch([group.customerName], search)),
    { page, pageSize },
  );
  const certificatePage = pageOf(
    (view === "void" ? voided : received).filter((item) =>
      matchesSearch([item.payorName, item.payorTin, item.customerName, ...item.atcCodes, quarterLabel(item.periodFrom)], search),
    ),
    { page, pageSize },
  );
  const empty = view === "waiting" ? waitingPage.rows.length === 0 : certificatePage.rows.length === 0;

  return (
    <>
      <BackLink href="/payments">Payments</BackLink>
      {header}
      <ListPending>
        <div className="mt-5 grid gap-3">
          <ListSearch
            action="/payments/withholding"
            label="Search withholding"
            placeholder="Customer, payor or TIN"
            value={search}
            keep={{ view: view === "waiting" ? undefined : view, size: keptSize(pageSize) }}
          />
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ListViews
              label="Withholding by status"
              views={VIEWS.map((to) => ({ href: href(search, to), label: `${labels[to]} (${counts[to]})`, current: view === to }))}
            />
          </div>
        </div>

        <ListResults label="Loading withholding" skeleton={view === "waiting" ? <PendingListSkeleton /> : <CertificateListSkeleton />}>
          {empty ? (
            <section aria-label="Withholding list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `Nothing matches “${search}”` : emptyTitle(view, short)}
                description={search ? "Try the customer's or payor's name, or a TIN." : emptyHint(view, certificate.name)}
                action={
                  <Link href={href(null, view)} className={buttonVariants({ variant: "outline" })}>
                    {search ? "Clear search" : "Show all"}
                  </Link>
                }
              />
            </section>
          ) : view === "waiting" ? (
            <DataTable
              label="Waiting list"
              columns={pendingColumns(ctx.locale, short)}
              rows={waitingPage.rows}
              rowKey={(group) => `${group.customerId}-${group.currency}`}
              rowHref={(group) =>
                (canRecord ? `/payments/withholding/new?customer=${group.customerId}` : `/customers/${group.customerId}`) as Route
              }
              phoneSummary={pendingSummaryLine(ctx.locale)}
              controls={2}
              meta={waitingPage.meta}
              noun={{ singular: "customer", plural: "customers" }}
              hrefFor={pagedHref("/payments/withholding", { q: search }, pageSize)}
            />
          ) : (
            <DataTable
              label="Certificate list"
              columns={certificateColumns(ctx.locale)}
              rows={certificatePage.rows}
              rowKey={(row) => row.id}
              rowHref={(row) => `/payments/withholding/${row.id}` as Route}
              phoneSummary={certificateSummaryLine(ctx.locale)}
              controls={2}
              meta={certificatePage.meta}
              noun={{ singular: "certificate", plural: "certificates" }}
              hrefFor={pagedHref("/payments/withholding", { q: search, view }, pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}

function emptyTitle(view: View, short: string) {
  if (view === "waiting") return `Nothing is waiting for a ${short}`;
  return view === "received" ? `No ${short} certificates recorded yet` : "No void certificates";
}

function emptyHint(view: View, name: string) {
  if (view === "waiting") return `Every payment with tax withheld has its ${name} recorded.`;
  return view === "received"
    ? `When a customer sends their ${name}, record it from the Waiting tab.`
    : "A certificate recorded by mistake can be voided with a reason. It stays here, out of your totals.";
}
