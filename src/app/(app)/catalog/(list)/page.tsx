import type { Metadata, Route } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { keptSize, ListSearch, ListViews, listHref, pageParam, pagedHref, sizeParam } from "@/components/list-controls";
import { ListPending, ListResults } from "@/components/list-pending";
import { buttonVariants } from "@/components/ui/button";
import { categoryFor } from "@/config/categories";
import { type CatalogItemKind, type CatalogStatus, listCatalogItems } from "@/modules/catalog";
import { requireOrgContext } from "@/modules/identity";
import { parsePageSize } from "@/shared/pagination/page-window";
import { normalizeSearch } from "@/shared/text/search";
import { CatalogListSkeleton, catalogColumns } from "../_components/catalog-list";
import { itemHref, KIND_LABEL, KIND_SEGMENT, KIND_TABS, kindFromSegment, newItemHref, startingKind } from "../_lib/kinds";

export const metadata: Metadata = { title: "Products & Services" };

const catalogHref = (kind: CatalogItemKind, q: string | null, status: CatalogStatus, size: number) =>
  listHref("/catalog", {
    type: KIND_SEGMENT[kind],
    q,
    status: status === "archived" ? "archived" : null,
    size: sizeParam(size),
  });

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const requested = kindFromSegment(String(params.type ?? ""));
  const search = normalizeSearch(params.q);
  const status: CatalogStatus = params.status === "archived" ? "archived" : "active";
  const page = pageParam(params.page);
  const load = (of: CatalogItemKind) =>
    listCatalogItems(ctx, of, { search, status, page, pageSize: parsePageSize(params.size) });
  let kind = requested ?? KIND_TABS[0] ?? "product";
  let list = await load(kind);
  // A link that doesn't name a tab opens on the first one that has something in it.
  if (!requested && list.total === 0) {
    const other = KIND_TABS.find((tab) => tab !== kind) ?? "service";
    const alternative = await load(other);
    const opens = startingKind({ [kind]: list.total, [other]: alternative.total } as Record<CatalogItemKind, number>);
    if (opens === other) {
      kind = other;
      list = alternative;
    }
  }
  const label = KIND_LABEL[kind];
  // Starter names for the business's own kind of work: a head start, never prices or invented data.
  const starters =
    kind === "service" && ctx.organizationCategory && !search && status === "active" && list.total === 0
      ? categoryFor(ctx.organizationCategory).starterItems
      : [];

  return (
    <>
      <PageHeader
        title="Products & Services"
        description="What you sell, with your usual prices. Add them to a quote in one tap."
        actions={
          <Link href={newItemHref(kind)} className={buttonVariants()}>
            <PlusIcon aria-hidden="true" />
            Add {label.singular}
          </Link>
        }
      />

      <ListPending>
        <div className="mt-8">
          <ListViews
            label="Catalog lists"
            views={KIND_TABS.map((k) => ({
              href: catalogHref(k, null, "active", list.pageSize),
              label: KIND_LABEL[k].plural,
              current: k === kind,
            }))}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ListSearch
            action="/catalog"
            label={`Search ${label.plural.toLowerCase()}`}
            placeholder={kind === "product" ? "Name, description or SKU" : "Name or description"}
            value={search}
            keep={{ type: KIND_SEGMENT[kind], status: status === "archived" ? "archived" : undefined, size: keptSize(list.pageSize) }}
          />
          {(list.archivedCount > 0 || status === "archived") && (
            <ListViews
              label={`${label.plural} by status`}
              views={[
                { href: catalogHref(kind, search, "active", list.pageSize), label: "Active", current: status === "active" },
                {
                  href: catalogHref(kind, search, "archived", list.pageSize),
                  label: `Archived (${list.archivedCount})`,
                  current: status === "archived",
                },
              ]}
            />
          )}
        </div>

        <ListResults label="Loading products and services" skeleton={<CatalogListSkeleton kind={kind} />}>
          {list.items.length === 0 ? (
            <section
              aria-label={`${label.plural} list`}
              className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs"
            >
              <EmptyState
                title={
                  search
                    ? `No ${label.plural.toLowerCase()} match “${search}”`
                    : status === "archived"
                      ? `No archived ${label.plural.toLowerCase()}`
                      : `No ${label.plural.toLowerCase()} yet`
                }
                description={
                  search
                    ? "Check the spelling, or try a shorter search."
                    : status === "archived"
                      ? `${label.plural} you archive appear here.`
                      : `Save the ${label.plural.toLowerCase()} you sell with their usual price, so adding them to a quote takes one tap.`
                }
                action={
                  search ? (
                    <Link href={catalogHref(kind, null, status, list.pageSize)} className={buttonVariants({ variant: "outline" })}>
                      Clear search
                    </Link>
                  ) : (
                    status === "active" && (
                      <div className="grid justify-items-center gap-4">
                        <Link href={newItemHref(kind)} className={buttonVariants()}>
                          <PlusIcon aria-hidden="true" />
                          Add {label.singular}
                        </Link>
                        {starters.length > 0 && (
                          <div className="grid justify-items-center gap-2">
                            <p className="text-sm text-muted-foreground">Or start from a common one. You set the price.</p>
                            <ul className="flex flex-wrap justify-center gap-2">
                              {starters.map((item) => (
                                <li key={item.name}>
                                  <Link
                                    href={`${newItemHref(kind)}?name=${encodeURIComponent(item.name)}&unit=${encodeURIComponent(item.unit)}` as Route}
                                    className={buttonVariants({ variant: "outline", size: "sm" })}
                                  >
                                    {item.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                  )
                }
              />
            </section>
          ) : (
            <DataTable
              label={`${label.plural} list`}
              columns={catalogColumns(kind, ctx.locale)}
              rows={list.items}
              rowKey={(item) => item.id}
              rowHref={(item) => itemHref(kind, item.id)}
              controls={2}
              meta={list}
              noun={{ singular: label.singular, plural: label.plural.toLowerCase() }}
              hrefFor={pagedHref(
                "/catalog",
                { type: KIND_SEGMENT[kind], q: search, status: status === "archived" ? "archived" : null },
                list.pageSize,
              )}
            />
          )}
        </ListResults>
      </ListPending>
    </>
  );
}
