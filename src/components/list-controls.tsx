import type { Route } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_SIZES, type PageSize } from "@/shared/pagination/page-window";
import { keptSize, listHref, pagedHref, sizeParam } from "./list-href";
import { LinkPending, ListLink } from "./list-pending";
import { ListSearch } from "./list-search";

export { keptSize, listHref, ListSearch, pagedHref, sizeParam };

// The controls every list page shares (DESIGN.md "Lists and records"). They
// are plain links and a GET form, so lists work without JavaScript and every
// view has its own URL. With JavaScript they also tell the list's rows (see
// list-pending.tsx) that a navigation is on its way.

/** Links between views of one list (e.g. Active / Archived); the current one is marked. */
export function ListViews({
  label,
  views,
}: {
  label: string;
  views: { href: Route; label: string; current: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex gap-1">
      {views.map((view) => (
        <Link
          key={view.href}
          href={view.href}
          aria-current={view.current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground pointer-coarse:py-3",
            view.current && "bg-card text-foreground shadow-xs ring-1 ring-border",
          )}
        >
          {view.label}
          <LinkPending />
        </Link>
      ))}
    </nav>
  );
}

/** Previous / Next with "Page 2 of 6"; renders nothing when everything fits on one page. Spreads across a phone's width. */
export function ListPager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => Route;
}) {
  if (pageCount <= 1) return null;
  const button = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2 sm:justify-start">
      {page > 1 ? (
        <ListLink href={hrefFor(page - 1)} className={button}>
          <ChevronLeftIcon aria-hidden="true" />
          Previous
        </ListLink>
      ) : (
        <span aria-disabled="true" className={cn(button, "opacity-50")}>
          <ChevronLeftIcon aria-hidden="true" />
          Previous
        </span>
      )}
      <span className="text-center text-sm whitespace-nowrap text-muted-foreground tabular-nums sm:min-w-24">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <ListLink href={hrefFor(page + 1)} className={button}>
          Next
          <ChevronRightIcon aria-hidden="true" />
        </ListLink>
      ) : (
        <span aria-disabled="true" className={cn(button, "opacity-50")}>
          Next
          <ChevronRightIcon aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

/** The page sizes of a list, as links; the one in use is marked. Changing the size starts again at page 1. */
export function PageSizeLinks({
  pageSize,
  hrefFor,
  className,
}: {
  pageSize: PageSize;
  hrefFor: (change: { size: PageSize }) => Route;
  className?: string;
}) {
  return (
    <nav aria-label="Rows per page" className={cn("flex items-center gap-1 text-sm", className)}>
      <span aria-hidden="true" className="mr-1 text-muted-foreground">
        Rows
      </span>
      {PAGE_SIZES.map((size) => (
        <ListLink
          key={size}
          href={hrefFor({ size })}
          aria-current={size === pageSize ? "true" : undefined}
          className={cn(
            "inline-flex items-center justify-center rounded-md px-2 py-1 font-medium tabular-nums text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-2.5",
            size === pageSize && "bg-surface-sunken text-foreground ring-1 ring-border",
          )}
        >
          {size}
        </ListLink>
      ))}
    </nav>
  );
}

/** The first value of a search param, e.g. `?page=2` → "2". */
export const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A `?page=` param as a page number (1 when missing or invalid). */
export const pageParam = (value: string | string[] | undefined) => {
  const page = Number(firstParam(value));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};
