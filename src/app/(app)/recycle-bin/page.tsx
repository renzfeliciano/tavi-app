import type { Metadata, Route } from "next";
import Link from "next/link";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { MissingCustomer } from "@/components/missing-customer";
import { MoneyAmount } from "@/components/money-amount";
import { SectionEmpty } from "@/components/app-shell/section-empty";
import { buttonVariants } from "@/components/ui/button";
import { can } from "@/modules/authz";
import { formatRate, listCatalogItems, listTaxRates } from "@/modules/catalog";
import { listCustomers } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { listTrash, TRASH_RETENTION_DAYS } from "@/modules/trash";
import { trashItemKindName, trashItemName } from "./_lib/trash-names";
import { archivedCustomerRestore, archivedItemRestore, archivedTaxRestore } from "./_lib/restore-actions";
import { discardTrashItemAction, emptyTrashAction, restoreTrashItemAction } from "./actions";
import { EmptyBinButton, RestoreButton, TrashRowActions } from "./_components/trash-actions";

export const metadata: Metadata = { title: "Recycle bin" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function RecycleBinPage() {
  const ctx = await requireOrgContext();
  const canDiscard = can(ctx, "organization.manage");
  const [trash, archivedCustomers, archivedProducts, archivedServices, taxRates] = await Promise.all([
    listTrash(ctx),
    listCustomers(ctx, { status: "archived" }),
    listCatalogItems(ctx, "product", { status: "archived" }),
    listCatalogItems(ctx, "service", { status: "archived" }),
    listTaxRates(ctx),
  ]);
  const archivedTaxes = taxRates.filter((rate) => rate.archivedAt !== null);
  const archivedTotal =
    archivedCustomers.archivedCount + archivedProducts.archivedCount + archivedServices.archivedCount + archivedTaxes.length;

  const when = new Intl.DateTimeFormat(ctx.locale, { dateStyle: "medium", timeZone: ctx.timezone });

  if (trash.length === 0 && archivedTotal === 0) {
    return (
      <>
        <BackLink href="/settings">Settings</BackLink>
        <PageHeader title="Recycle bin" description={`Deleted records wait here for ${TRASH_RETENTION_DAYS} days, so a slip can be undone.`} />
        <SectionEmpty
          title="Nothing deleted"
          description={`When you delete a record, it waits here for ${TRASH_RETENTION_DAYS} days before it's gone for good. Archived customers, products, services and taxes show up here too.`}
          expression="resting"
        />
      </>
    );
  }

  return (
    <>
      <BackLink href="/settings">Settings</BackLink>
      <PageHeader
        title="Recycle bin"
        description={`Deleted records wait here for ${TRASH_RETENTION_DAYS} days, then they're gone for good. Archived records stay until you restore them.`}
        actions={canDiscard && trash.length > 0 ? <EmptyBinButton count={trash.length} empty={emptyTrashAction} /> : undefined}
      />

      <div className="mt-8 grid gap-10">
        <section aria-labelledby="deleted-records">
          <h2 id="deleted-records" className="text-base font-semibold">
            Deleted records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Restoring brings a record back exactly as it was. Issued {ctx.market.documents.invoice.plural.toLowerCase()} are never
            deleted: void them instead.
          </p>
          {trash.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
              Nothing deleted.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {trash.map((item) => (
                <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="font-medium [overflow-wrap:anywhere]">
                      {trashItemKindName(item, ctx.market)} · {item.customerName ?? <MissingCustomer />}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Deleted {when.format(item.deletedAt)} ·{" "}
                      <span className={item.daysLeft <= 3 ? "font-medium text-warning-strong" : undefined}>
                        {item.daysLeft === 0 ? "removed today" : `${plural(item.daysLeft, "day", "days")} left`}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                    <MoneyAmount amountMinor={item.totalMinor} currency={item.currency} locale={ctx.locale} className="font-medium" />
                    <TrashRowActions
                      name={trashItemName(item, ctx.market)}
                      restore={restoreTrashItemAction.bind(null, item.kind, item.id)}
                      discard={canDiscard ? discardTrashItemAction.bind(null, item.id) : null}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {archivedTotal > 0 && (
          <section aria-labelledby="archived-records">
            <h2 id="archived-records" className="text-base font-semibold">
              Archived
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hidden from your lists and pickers. Documents that already use them keep their copy.
            </p>
            <div className="mt-4 grid gap-6">
              <ArchivedGroup
                title="Customers"
                total={archivedCustomers.archivedCount}
                shown={archivedCustomers.customers.map((c) => ({
                  id: c.id,
                  name: c.displayName,
                  detail: c.company ?? c.email ?? c.phone,
                  restore: archivedCustomerRestore(c.id),
                }))}
                allHref="/customers?status=archived"
              />
              <ArchivedGroup
                title="Products"
                total={archivedProducts.archivedCount}
                shown={archivedProducts.items.map((p) => ({
                  id: p.id,
                  name: p.name,
                  detail: p.sku,
                  restore: archivedItemRestore("product", p.id),
                }))}
                allHref="/catalog?type=products&status=archived"
              />
              <ArchivedGroup
                title="Services"
                total={archivedServices.archivedCount}
                shown={archivedServices.items.map((s) => ({
                  id: s.id,
                  name: s.name,
                  detail: s.description,
                  restore: archivedItemRestore("service", s.id),
                }))}
                allHref="/catalog?type=services&status=archived"
              />
              <ArchivedGroup
                title="Taxes"
                total={archivedTaxes.length}
                shown={archivedTaxes.map((rate) => ({
                  id: rate.id,
                  name: rate.name,
                  detail: formatRate(rate.rateBps, ctx.locale),
                  restore: archivedTaxRestore(rate.id),
                }))}
                allHref={null}
              />
            </div>
          </section>
        )}
      </div>
    </>
  );
}

type ArchivedRow = { id: string; name: string; detail: string | null; restore: () => Promise<{ ok: true } | { ok: false; error: string }> };

function ArchivedGroup({ title, total, shown, allHref }: { title: string; total: number; shown: ArchivedRow[]; allHref: string | null }) {
  if (total === 0) return null;
  const more = total - shown.length;
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">
        {title} ({total})
      </h3>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {shown.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="font-medium [overflow-wrap:anywhere]">{row.name}</p>
              {row.detail && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{row.detail}</p>}
            </div>
            <RestoreButton name={row.name} restore={row.restore} />
          </li>
        ))}
      </ul>
      {more > 0 && allHref && (
        <p className="mt-2 text-sm text-muted-foreground">
          And {more} more.{" "}
          <Link href={allHref as Route} className={buttonVariants({ variant: "link", size: "sm" })}>
            See all archived {title.toLowerCase()}
          </Link>
        </p>
      )}
    </div>
  );
}
