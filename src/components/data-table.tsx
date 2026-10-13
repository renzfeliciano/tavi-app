import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { describeRange, type PageMeta, type PageSize } from "@/shared/pagination/page-window";
import { FitPanel } from "./fit-panel";
import { ListPager, PageSizeLinks } from "./list-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { TextSkeleton, vary } from "./skeletons";

// The one table every list uses (DESIGN.md, "Lists and records"). A fixed-height
// panel: the column headers stay at the top, the rows scroll inside, and the
// count, page sizes and pager stay at the bottom, so a list never pushes the
// page around however many rows it has. Rows are CSS-grid divs with ARIA table
// roles (explicit roles keep the table semantics when the layout changes), and
// on a phone they stack: title and amount on the first line, a summary under.

/** What a column is, shared by the table and its skeleton so the two never drift. */
export type ColumnLayout = {
  id: string;
  /** The column header; also its name for screen readers. */
  header: string;
  /** The grid track from `sm` up, e.g. `minmax(0,2fr)` or `7rem`. */
  width: string;
  /** Amounts and counts: right-aligned with tabular figures. */
  align?: "start" | "end";
  /** Left out below this width. */
  hideBelow?: "md" | "lg";
  /**
   * On a phone: `title` (left of the first line, the first column's default), `end` (right of it), or `hide`
   * (the default for the others; `phoneSummary` says what they would).
   */
  phone?: "title" | "end" | "hide";
  /** The cell leads with a monogram disc (a person) or a square tile (a thing), which its skeleton draws too. */
  lead?: "disc" | "tile";
  /** How wide the skeleton's bar is, one size per line the real cell takes: `"lg"` or `["lg", "sm"]`. */
  skeleton: BarSize | readonly [BarSize, BarSize];
};

type BarSize = "xs" | "sm" | "md" | "lg";

/** Bar widths by size, varied from row to row so a skeleton list doesn't look like a barcode. */
const BARS: Record<BarSize, readonly string[]> = {
  xs: ["w-10", "w-12", "w-9"],
  sm: ["w-16", "w-20", "w-14"],
  md: ["w-28", "w-32", "w-24"],
  lg: ["w-40", "w-48", "w-36"],
};

export type DataColumn<Row> = ColumnLayout & { cell: (row: Row) => ReactNode };

/**
 * Panel height before `FitPanel` has measured the page (the server's HTML, and without JavaScript): the window less
 * what is above and below it on a page with nothing extra above it (the top bar, page header and the controls over
 * the table, a search plus a row of tabs for some lists, and on a phone and tablet the tab bar under it). Once the
 * page is up, `FitPanel` replaces it with what is really left, which also counts a notice above the page.
 * Written out in full for Tailwind; `e2e/data-table.spec.ts` measures the result at phone, tablet and desktop sizes.
 */
const PANEL_HEIGHT = {
  1: "h-[clamp(22rem,calc(100dvh-23rem),64rem)] sm:h-[clamp(22rem,calc(100dvh-20rem),64rem)] lg:h-[clamp(22rem,calc(100dvh-14rem),64rem)]",
  2: "h-[clamp(22rem,calc(100dvh-27rem),64rem)] sm:h-[clamp(22rem,calc(100dvh-23rem),64rem)] lg:h-[clamp(22rem,calc(100dvh-17rem),64rem)]",
  // The same, with a summary strip (`SummaryStrip`) over the controls.
  "1s": "h-[clamp(22rem,calc(100dvh-27.5rem),64rem)] sm:h-[clamp(22rem,calc(100dvh-26.5rem),64rem)] lg:h-[clamp(22rem,calc(100dvh-20.8rem),64rem)]",
  "2s": "h-[clamp(22rem,calc(100dvh-34.8rem),64rem)] sm:h-[clamp(22rem,calc(100dvh-29.5rem),64rem)] lg:h-[clamp(22rem,calc(100dvh-23.8rem),64rem)]",
} as const;

/** How many rows of controls sit over the table: just a search (1), or a search and tabs (2). */
type Controls = 1 | 2;

const panel = (controls: Controls, strip: boolean) =>
  cn("flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs", PANEL_HEIGHT[strip ? (`${controls}s` as const) : controls]);

/** Row layout: two columns on a phone, the table's grid from `sm`, with the template of each width. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 sm:[grid-template-columns:var(--cols-sm)] md:[grid-template-columns:var(--cols-md)] lg:[grid-template-columns:var(--cols-lg)] sm:px-6";

const FOOTER =
  "flex shrink-0 flex-col gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6";

/** The grid templates at sm, md and lg: every column that is showing at that width. */
function templates(columns: readonly ColumnLayout[]): CSSProperties {
  const at = (visible: (column: ColumnLayout) => boolean) =>
    columns
      .filter(visible)
      .map((column) => column.width)
      .join(" ");
  return {
    "--cols-sm": at((c) => !c.hideBelow),
    "--cols-md": at((c) => c.hideBelow !== "lg"),
    "--cols-lg": at(() => true),
  } as CSSProperties;
}

/** Where a column's cell goes on a phone and from sm up. The first column is always the title. */
function cellClass(column: ColumnLayout, index: number) {
  const phone = column.phone ?? (index === 0 ? "title" : "hide");
  return cn(
    phone === "title" && "col-start-1 sm:col-auto",
    phone === "end" && "col-start-2 row-start-1 text-right sm:col-auto sm:row-auto",
    phone === "hide" && "max-sm:hidden",
    column.hideBelow === "md" && "max-md:hidden",
    column.hideBelow === "lg" && "max-lg:hidden",
    column.align === "end" && "text-right tabular-nums",
  );
}

/** Every row is as tall as one that has two lines of text, so a row with one doesn't look squashed. */
const ROW = cn(ROW_GRID, "min-h-16 gap-y-0.5 py-3 pointer-coarse:py-2.5");

/** The count, the page sizes and the pager, which stay in view under the scrolling rows. */
function Footer({
  label,
  meta,
  noun,
  hrefFor,
}: {
  label: string;
  meta: PageMeta;
  noun: { singular: string; plural: string };
  hrefFor: (change: { page?: number; size?: PageSize }) => Route;
}) {
  return (
    <div role="group" aria-label={`${label} footer`} className={FOOTER}>
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {describeRange(meta, noun)}
      </p>
      {/* On a phone this row is the pager and nothing else, so it isn't there at all when everything fits one page. */}
      <div className="hidden min-h-7 items-center gap-4 pointer-coarse:min-h-11 has-[nav[aria-label=Pages]]:flex sm:flex sm:justify-end sm:gap-6">
        {/* Not on a phone, where the pager takes the whole width and 25 rows is plenty. */}
        <PageSizeLinks pageSize={meta.pageSize} hrefFor={hrefFor} className="max-sm:hidden" />
        <ListPager page={meta.page} pageCount={meta.pageCount} hrefFor={(page) => hrefFor({ page })} />
      </div>
    </div>
  );
}

export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  rowHref,
  phoneSummary,
  meta,
  noun,
  hrefFor,
  controls = 1,
  strip = false,
}: {
  /** Names the panel and the table, e.g. "Customer list". */
  label: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Where a row opens: the whole row is the link, through its first cell. */
  rowHref: (row: Row) => Route;
  /** A line under the title on a phone, in place of the columns it leaves out. */
  phoneSummary?: (row: Row) => ReactNode;
  meta: PageMeta;
  noun: { singular: string; plural: string };
  hrefFor: (change: { page?: number; size?: PageSize }) => Route;
  controls?: Controls;
  /** A `SummaryStrip` sits over the controls, taking some of the window. */
  strip?: boolean;
}) {
  return (
    <FitPanel label={label} className={cn("mt-4", panel(controls, strip))}>
      <div data-testid="data-table-scroll" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div role="table" aria-label={label} aria-rowcount={meta.matching + 1} style={templates(columns)}>
          <div role="rowgroup" className="sticky top-0 z-10 bg-card">
            <div
              role="row"
              aria-rowindex={1}
              className={cn(ROW_GRID, "border-b border-border bg-surface-sunken py-2 max-sm:hidden")}
            >
              {columns.map((column) => (
                <div
                  key={column.id}
                  role="columnheader"
                  className={cn(
                    "text-xs font-medium text-muted-foreground",
                    column.hideBelow === "md" && "max-md:hidden",
                    column.hideBelow === "lg" && "max-lg:hidden",
                    column.align === "end" && "text-right",
                  )}
                >
                  {column.header}
                </div>
              ))}
            </div>
          </div>
          <div role="rowgroup">
            {rows.map((row, rowIndex) => (
              <div
                key={rowKey(row)}
                role="row"
                aria-rowindex={meta.from + rowIndex + 1}
                className={cn(
                  ROW,
                  "relative border-b border-border transition-colors duration-(--duration-fast) last:border-b-0 hover:bg-accent has-[a:focus-visible]:bg-accent",
                )}
              >
                {columns.map((column, index) => (
                  <div key={column.id} role="cell" className={cellClass(column, index)}>
                    {index === 0 ? (
                      <Link
                        href={rowHref(row)}
                        className="block min-w-0 outline-none after:absolute after:inset-0 pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:flex-col pointer-coarse:justify-center focus-visible:after:ring-3 focus-visible:after:ring-ring/35 focus-visible:after:ring-inset"
                      >
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </div>
                ))}
                {phoneSummary && (
                  <div
                    role="cell"
                    data-slot="data-table-summary"
                    className="col-span-2 min-w-0 text-sm text-muted-foreground sm:hidden"
                  >
                    {phoneSummary(row)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer label={label} meta={meta} noun={noun} hrefFor={hrefFor} />
    </FitPanel>
  );
}

/**
 * The panel while rows are on their way: the same height, header, row grid and footer, with bars where the
 * text will be. The column headers are real text, because they don't change.
 */
export function DataTableSkeleton({
  label,
  columns,
  rows = 8,
  summary = false,
  controls = 1,
  strip = false,
}: {
  label: string;
  columns: readonly ColumnLayout[];
  rows?: number;
  /** The table has a phone summary line. */
  summary?: boolean;
  controls?: Controls;
  strip?: boolean;
}) {
  return (
    <FitPanel label={label} className={cn("mt-4", panel(controls, strip))}>
      <div className="min-h-0 flex-1 overflow-hidden" style={templates(columns)}>
        <div className={cn(ROW_GRID, "border-b border-border bg-surface-sunken py-2 max-sm:hidden")}>
          {columns.map((column) => (
            <div
              key={column.id}
              className={cn(
                "text-xs font-medium text-muted-foreground",
                column.hideBelow === "md" && "max-md:hidden",
                column.hideBelow === "lg" && "max-lg:hidden",
                column.align === "end" && "text-right",
              )}
            >
              {column.header}
            </div>
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className={cn(ROW, "border-b border-border last:border-b-0")}>
            {columns.map((column, index) => (
              <div key={column.id} className={cellClass(column, index)}>
                <div className={cn(column.lead && "flex items-center gap-3")}>
                  {column.lead && <Skeleton className={cn("size-9 shrink-0", column.lead === "disc" ? "rounded-full" : "rounded-md")} />}
                  <div className="min-w-0 flex-1">
                    {(typeof column.skeleton === "string" ? [column.skeleton] : column.skeleton).map((size, line) => (
                      <TextSkeleton
                        key={line}
                        width={vary(BARS[size], rowIndex + index + line)}
                        className={column.align === "end" ? "justify-end" : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {summary && (
              <div className="col-span-2 min-w-0 sm:hidden">
                <TextSkeleton width={vary(BARS.lg, rowIndex)} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={FOOTER}>
        <TextSkeleton width="w-48" />
        <div className="flex items-center gap-4 sm:justify-end sm:gap-6">
          <Skeleton className="h-7 w-40 max-sm:hidden pointer-coarse:h-11" />
          <Skeleton className="h-7 w-full pointer-coarse:h-11 sm:w-60" />
        </div>
      </div>
    </FitPanel>
  );
}
