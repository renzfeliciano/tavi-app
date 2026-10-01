import type { Route } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAX_SEARCH_LENGTH } from "@/shared/text/search";

// The controls every list page shares (DESIGN.md "Lists and records"). They
// are plain links and a GET form, so lists work without JavaScript and every
// view has its own URL.

/** A search box that submits `?q=` to `action`, keeping the other params. */
export function ListSearch({
  action,
  label,
  placeholder,
  value,
  keep = {},
}: {
  action: Route;
  label: string;
  placeholder: string;
  value: string | null;
  /** Other params to keep, e.g. the current view. */
  keep?: Record<string, string | undefined>;
}) {
  const id = `search-${action.replace(/\W+/g, "-")}`;
  return (
    <form role="search" action={action} className="relative w-full sm:max-w-sm">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        name="q"
        defaultValue={value ?? ""}
        maxLength={MAX_SEARCH_LENGTH}
        placeholder={placeholder}
        className="pl-9"
      />
      {Object.entries(keep).map(([name, keptValue]) =>
        keptValue ? <input key={name} type="hidden" name={name} value={keptValue} /> : null,
      )}
    </form>
  );
}

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
        </Link>
      ))}
    </nav>
  );
}

/** Previous / Next for a paged list; renders nothing when everything fits on one page. */
export function ListPager({
  page,
  hasMore,
  hrefFor,
}: {
  page: number;
  hasMore: boolean;
  hrefFor: (page: number) => Route;
}) {
  if (page <= 1 && !hasMore) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonVariants({ variant: "outline" })}>
          <ChevronLeftIcon aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">Page {page}</span>
      {hasMore ? (
        <Link href={hrefFor(page + 1)} className={buttonVariants({ variant: "outline" })}>
          Next
          <ChevronRightIcon aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Builds a list URL from its params, leaving out empty and default ones. */
export function listHref(path: string, params: Record<string, string | number | null | undefined>): Route {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(name, String(value));
  }
  const query = search.toString();
  return (query ? `${path}?${query}` : path) as Route;
}

/** The first value of a search param, e.g. `?page=2` → "2". */
export const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A `?page=` param as a page number (1 when missing or invalid). */
export const pageParam = (value: string | string[] | undefined) => {
  const page = Number(firstParam(value));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
};
