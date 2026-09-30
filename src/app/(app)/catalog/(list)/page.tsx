import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListPager, ListSearch, ListViews, listHref, pageParam } from "@/components/list-controls";
import { MoneyAmount } from "@/components/money-amount";
import { buttonVariants } from "@/components/ui/button";
import { type CatalogItemKind, type CatalogStatus, listCatalogItems } from "@/modules/catalog";
import { requireOrgContext } from "@/modules/identity";
import { normalizeSearch } from "@/shared/text/search";
import { itemHref, KIND_LABEL, KIND_SEGMENT, kindFromSegment, newItemHref } from "../_lib/kinds";

export const metadata: Metadata = { title: "Products & Services" };

// Services first: most TAVI businesses sell their time and skill.
const KINDS: CatalogItemKind[] = ["service", "product"];

const catalogHref = (kind: CatalogItemKind, q: string | null, status: CatalogStatus, page?: number) =>
  listHref("/catalog", {
    type: KIND_SEGMENT[kind],
    q,
    status: status === "archived" ? "archived" : null,
    page: page && page > 1 ? page : null,
  });

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const kind = kindFromSegment(String(params.type ?? "")) ?? "service";
  const search = normalizeSearch(params.q);
  const status: CatalogStatus = params.status === "archived" ? "archived" : "active";
  const page = pageParam(params.page);
  const list = await listCatalogItems(ctx, kind, { search, status, page });
  const label = KIND_LABEL[kind];

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

      <div className="mt-8">
        <ListViews
          label="Catalog lists"
          views={KINDS.map((k) => ({
            href: catalogHref(k, null, "active"),
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
          keep={{ type: KIND_SEGMENT[kind], status: status === "archived" ? "archived" : undefined }}
        />
        {(list.archivedCount > 0 || status === "archived") && (
          <ListViews
            label={`${label.plural} by status`}
            views={[
              { href: catalogHref(kind, search, "active"), label: "Active", current: status === "active" },
              {
                href: catalogHref(kind, search, "archived"),
                label: `Archived (${list.archivedCount})`,
                current: status === "archived",
              },
            ]}
          />
        )}
      </div>

      <section
        aria-label={`${label.plural} list`}
        className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      >
        {list.items.length === 0 ? (
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
                <Link href={catalogHref(kind, null, status)} className={buttonVariants({ variant: "outline" })}>
                  Clear search
                </Link>
              ) : (
                status === "active" && (
                  <Link href={newItemHref(kind)} className={buttonVariants()}>
                    <PlusIcon aria-hidden="true" />
                    Add {label.singular}
                  </Link>
                )
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={itemHref(kind, item.id)}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-(--duration-fast) hover:bg-accent sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.name}</span>
                    {(item.sku || item.description) && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {item.sku && <span className="font-mono">{item.sku}</span>}
                        {item.sku && item.description && " · "}
                        {item.description}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <MoneyAmount amountMinor={item.unitPriceMinor} currency={item.currency} locale={ctx.locale} />
                    <span className="block text-muted-foreground">per {item.unitLabel}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListPager page={list.page} hasMore={list.hasMore} hrefFor={(p) => catalogHref(kind, search, status, p)} />
    </>
  );
}
