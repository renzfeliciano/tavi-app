import type { Metadata, Route } from "next";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgContext } from "@/modules/identity";
import { listSchedules, type ScheduleStatus } from "@/modules/invoices";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { ScheduleListSkeleton, scheduleColumns, scheduleSummary } from "../_components/schedule-list";
import { SCHEDULE_STATUS } from "../_components/schedule-status";

export const metadata: Metadata = { title: "Recurring" };

const STATUSES = ["active", "paused", "ended"] as const satisfies readonly ScheduleStatus[];
const isStatus = (value: unknown): value is ScheduleStatus => STATUSES.includes(value as ScheduleStatus);

const recurringHref = (q: string | null, status: ScheduleStatus | null, size: number) =>
  listHref("/recurring", { q, status, size: sizeParam(size) });

export default async function RecurringPage({ searchParams }: PageProps<"/recurring">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const search = normalizeSearch(params.q);
  const status = isStatus(params.status) ? params.status : null;
  const list = await listSchedules(ctx, {
    search,
    status: status ?? undefined,
    page: pageParam(params.page),
    pageSize: parsePageSize(params.size),
  });
  const { plural } = ctx.market.documents.invoice;
  const description = `${plural} that repeat. A draft is made on each due date for you to check and send.`;

  if (list.total === 0) {
    return (
      <>
        <PageHeader title="Recurring" description={description} />
        <SectionEmpty
          title="Nothing repeats yet"
          description={`Open a ${ctx.market.documents.invoice.singular.toLowerCase()} you have sent and choose “Repeat this”. Pick how often, and a draft is made each time for you to check. Nothing is sent by itself.`}
          action={{ href: "/invoices", label: `Open ${plural.toLowerCase()}`, icon: ReceiptTextIcon }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Recurring" description={description} />

      <ListPending>
        <div className="mt-8 grid gap-3">
          <ListSearch
            action="/recurring"
            label="Search recurring statements"
            placeholder="Customer name"
            value={search}
            keep={{ status: status ?? undefined, size: keptSize(list.pageSize) }}
          />
          <ListViews
            label="Recurring statements by status"
            views={[
              { href: recurringHref(search, null, list.pageSize), label: "All", current: status === null },
              ...STATUSES.map((s) => ({
                href: recurringHref(search, s, list.pageSize),
                label: SCHEDULE_STATUS[s].label,
                current: status === s,
              })),
            ]}
          />
        </div>

        <ListResults label="Loading recurring statements" skeleton={<ScheduleListSkeleton />}>
          {list.schedules.length === 0 ? (
            <section aria-label="Recurring list" className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <EmptyState
                title={search ? `No recurring statements match “${search}”` : "None here"}
                description={search ? "Try the customer's name." : "Nothing has this status."}
                action={
                  <Link href={recurringHref(null, null, list.pageSize) as Route} className={buttonVariants({ variant: "outline" })}>
                    Show all
                  </Link>
                }
              />
            </section>
          ) : (
            <DataTable
              label="Recurring list"
              columns={scheduleColumns(ctx.locale)}
              rows={list.schedules}
              rowKey={(schedule) => schedule.id}
              rowHref={(schedule) => `/recurring/${schedule.id}` as Route}
              phoneSummary={scheduleSummary(ctx.locale)}
              meta={list}
              noun={{ singular: "schedule", plural: "schedules" }}
              hrefFor={pagedHref("/recurring", { q: search, status }, list.pageSize)}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
