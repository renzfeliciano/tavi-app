import { render, screen, within } from "@testing-library/react";
import type { Route } from "next";
import { describe, expect, it, vi } from "vitest";
import type { PageMeta } from "@/shared/pagination/page-window";
import { type DataColumn, DataTable, DataTableSkeleton } from "./data-table";
import { ListPending } from "./list-pending";

// The data-table rule (CLAUDE.md): a fixed-height panel with one inner scroll
// and a sticky header; an item count, page sizes and a pager that stay in view.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

type Row = { id: string; name: string; email: string; city: string };
const rows: Row[] = [
  { id: "a1", name: "Ana Reyes", email: "ana@example.com", city: "Cebu" },
  { id: "b2", name: "Ben Cruz", email: "ben@example.com", city: "Davao" },
];

const columns: DataColumn<Row>[] = [
  { id: "name", header: "Customer", width: "minmax(0,2fr)", phone: "title", lead: "disc", skeleton: ["lg", "md"], cell: (r) => r.name },
  { id: "email", header: "Email", width: "minmax(0,2fr)", skeleton: "lg", cell: (r) => r.email },
  { id: "city", header: "City", width: "minmax(0,1fr)", hideBelow: "lg", skeleton: "sm", cell: (r) => r.city },
  { id: "total", header: "Balance", width: "7rem", align: "end", phone: "end", skeleton: "sm", cell: () => "₱0.00" },
];

const meta = (overrides: Partial<PageMeta> = {}): PageMeta => ({
  page: 1,
  pageSize: 25,
  pageCount: 1,
  from: 1,
  to: 2,
  matching: 2,
  hasMore: false,
  ...overrides,
});

const hrefFor = ({ page = 1, size = 25 }: { page?: number; size?: number }) =>
  `/customers?page=${page}&size=${size}` as Route;

function table(over: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <ListPending>
      <DataTable
        label="Customer list"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/customers/${r.id}` as Route}
        phoneSummary={(r) => r.email}
        meta={meta()}
        noun={{ singular: "customer", plural: "customers" }}
        hrefFor={hrefFor}
        {...over}
      />
    </ListPending>,
  );
}

describe("DataTable", () => {
  it("keeps every row the same height, whether it has one line of text or two", () => {
    table();

    for (const row of screen.getAllByRole("row").slice(1)) expect(row).toHaveClass("min-h-16");
  });

  it("is a table with its columns, rows and cells, named for screen readers", () => {
    table();

    const grid = screen.getByRole("table", { name: "Customer list" });
    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Customer", "Email", "City", "Balance"]);
    // The header row and the two customers.
    expect(within(grid).getAllByRole("row")).toHaveLength(3);
    // Four cells each, and the phone's summary line (hidden from sm up).
    expect(within(grid).getAllByRole("cell")).toHaveLength(10);
  });

  it("tells assistive tech which rows of the whole result are on this page", () => {
    table({ meta: meta({ page: 2, pageSize: 10, pageCount: 3, from: 11, to: 12, matching: 22 }) });

    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "23");
    const [, first, second] = screen.getAllByRole("row");
    expect(first).toHaveAttribute("aria-rowindex", "12");
    expect(second).toHaveAttribute("aria-rowindex", "13");
  });

  it("has a fixed-height panel whose only scroll is inside it, so the header and footer stay put", () => {
    table();

    const panel = screen.getByRole("region", { name: "Customer list" });
    expect(panel).toHaveClass("flex", "flex-col", "overflow-hidden");
    expect(panel.className).toMatch(/\bh-\[clamp\(/);
    const scroller = screen.getByTestId("data-table-scroll");
    expect(scroller).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    // Sideways scroll never appears; the columns fit.
    expect(scroller).toHaveClass("overflow-x-hidden");
  });

  it("leaves room for the tabs over the table on lists that have them, in the skeleton as in the table", () => {
    const panelOf = (el: HTMLElement) => el.className.match(/\bh-\[clamp\([^\]]*\]/)?.[0];

    const search = table();
    const searchOnly = panelOf(screen.getByRole("region", { name: "Customer list" }));
    search.unmount();
    const tabbed = table({ controls: 2 });
    const withTabs = panelOf(screen.getByRole("region", { name: "Customer list" }));
    tabbed.unmount();

    // A second row of controls takes more of the window, so the panel is shorter and its footer still in view.
    expect(withTabs).toBeDefined();
    expect(withTabs).not.toBe(searchOnly);

    const { container } = render(<DataTableSkeleton label="Customer list" columns={columns} controls={2} />);
    expect(panelOf(container.firstElementChild as HTMLElement)).toBe(withTabs);
  });

  it("leaves room for a summary strip over the controls, in the skeleton as in the table", () => {
    const panelOf = (el: HTMLElement) => el.className.match(/\bh-\[clamp\([^\]]*\]/)?.[0];

    const plain = table({ controls: 2 });
    const without = panelOf(screen.getByRole("region", { name: "Customer list" }));
    plain.unmount();
    const stripped = table({ controls: 2, strip: true });
    const withStrip = panelOf(screen.getByRole("region", { name: "Customer list" }));
    stripped.unmount();
    const searchStrip = table({ strip: true });
    const searchWithStrip = panelOf(screen.getByRole("region", { name: "Customer list" }));
    searchStrip.unmount();

    // The strip takes some of the window, so the panel is shorter, and the footer is still in view.
    expect(withStrip).toBeDefined();
    expect(withStrip).not.toBe(without);
    expect(searchWithStrip).not.toBe(withStrip);

    const { container } = render(<DataTableSkeleton label="Customer list" columns={columns} controls={2} strip />);
    expect(panelOf(container.firstElementChild as HTMLElement)).toBe(withStrip);
  });

  it("makes the row's link and the page sizes full-size touch targets, 44px on touch screens", () => {
    table({ meta: meta({ pageCount: 3, matching: 60 }) });

    // The link that stands for the whole row, whatever its title's height.
    expect(screen.getByRole("link", { name: /Ana Reyes/ })).toHaveClass("pointer-coarse:min-h-11");
    const sizes = screen.getByRole("navigation", { name: "Rows per page" });
    for (const link of within(sizes).getAllByRole("link")) {
      expect(link).toHaveClass("pointer-coarse:min-h-11", "pointer-coarse:min-w-11");
    }
  });

  it("keeps the column headers in view while the rows scroll under them", () => {
    table();

    const headerGroup = screen.getAllByRole("rowgroup")[0] as HTMLElement;
    expect(headerGroup).toHaveClass("sticky", "top-0", "z-10", "bg-card");
    expect(within(headerGroup).getAllByRole("columnheader")).toHaveLength(4);
  });

  it("puts the count, page sizes and pager outside the scroll, always in view", () => {
    table({ meta: meta({ page: 2, pageSize: 10, pageCount: 3, from: 11, to: 20, matching: 24 }) });

    const footer = screen.getByRole("group", { name: "Customer list footer" });
    expect(footer).toHaveClass("shrink-0");
    expect(screen.getByTestId("data-table-scroll").contains(footer)).toBe(false);
    expect(within(footer).getByText("Showing 11–20 of 24 customers")).toBeInTheDocument();
    expect(within(footer).getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("opens a record from anywhere on its row, through one link in the first cell", () => {
    table();

    const links = screen.getAllByRole("link", { name: /Ana Reyes/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/customers/a1");
    expect(links[0]).toHaveClass("after:absolute", "after:inset-0");
    expect(links[0]?.closest('[role="row"]')).toHaveClass("relative");
  });

  it("stacks on a phone: title and amount on the first line, a summary under, other columns left out", () => {
    table();

    const [, first] = screen.getAllByRole("row");
    const cells = within(first as HTMLElement).getAllByRole("cell");
    const byText = (text: string) => cells.find((c) => c.textContent === text) as HTMLElement;
    expect(byText("Ana Reyes")).toHaveClass("col-start-1");
    expect(byText("₱0.00")).toHaveClass("col-start-2", "row-start-1", "text-right");
    // Not title or end: hidden on a phone, shown from sm up.
    expect(byText("ana@example.com")).toHaveClass("max-sm:hidden");
    expect(byText("Cebu")).toHaveClass("max-sm:hidden", "max-lg:hidden");
    // The summary takes the place of the hidden columns on a phone and is gone from sm up.
    const summary = cells.find((c) => c.dataset.slot === "data-table-summary") as HTMLElement;
    expect(summary).toHaveClass("col-span-2", "sm:hidden");
    expect(summary).toHaveTextContent("ana@example.com");
  });

  it("lays columns out on the grid by their widths, dropping the ones hidden at each size", () => {
    table();

    const grid = screen.getByRole("table");
    expect(grid.style.getPropertyValue("--cols-sm")).toBe("minmax(0,2fr) minmax(0,2fr) 7rem");
    expect(grid.style.getPropertyValue("--cols-md")).toBe("minmax(0,2fr) minmax(0,2fr) 7rem");
    expect(grid.style.getPropertyValue("--cols-lg")).toBe("minmax(0,2fr) minmax(0,2fr) minmax(0,1fr) 7rem");
    // A phone has no columns to head: the stacked rows speak for themselves.
    expect(screen.getAllByRole("row")[0]).toHaveClass("max-sm:hidden");
  });

  it("right-aligns amounts, in the header too", () => {
    table();

    expect(screen.getByRole("columnheader", { name: "Balance" })).toHaveClass("text-right");
    expect(screen.getAllByRole("cell").find((c) => c.textContent === "₱0.00")).toHaveClass("text-right", "tabular-nums");
  });
});

describe("DataTable footer", () => {
  it("counts what is shown out of what matches, singular and plural", () => {
    table({ meta: meta({ from: 26, to: 50, matching: 143, page: 2, pageCount: 6 }) });
    expect(screen.getByText("Showing 26–50 of 143 customers")).toBeInTheDocument();
  });

  it("offers the page sizes as links that keep everything else and start over at page 1", () => {
    table({ meta: meta({ page: 3, pageSize: 25, pageCount: 6, from: 51, to: 75, matching: 143 }) });

    const sizes = screen.getByRole("navigation", { name: "Rows per page" });
    expect(within(sizes).getAllByRole("link").map((l) => l.textContent)).toEqual(["10", "25", "50", "100"]);
    expect(within(sizes).getByRole("link", { name: "10" })).toHaveAttribute("href", "/customers?page=1&size=10");
    expect(within(sizes).getByRole("link", { name: "25" })).toHaveAttribute("aria-current", "true");
  });

  it("leaves the page sizes to larger screens, so a phone's pager has the whole width", () => {
    table({ meta: meta({ page: 2, pageCount: 3, from: 26, to: 50, matching: 60 }) });

    expect(screen.getByRole("navigation", { name: "Rows per page" })).toHaveClass("max-sm:hidden");
    expect(screen.getByRole("navigation", { name: "Pages" })).toHaveClass("justify-between", "sm:justify-start");
  });

  it("is only the count on a phone when everything fits one page, with no empty row of controls under it", () => {
    table();

    // The row that holds the sizes and pager is shown on a phone only while it has a pager in it.
    const controls = screen.getByRole("navigation", { name: "Rows per page" }).parentElement;
    expect(controls).toHaveClass("hidden", "has-[nav[aria-label=Pages]]:flex", "sm:flex");
  });

  it("pages with Previous and Next, off at the ends", () => {
    table({ meta: meta({ page: 1, pageCount: 3, hasMore: true, from: 1, to: 25, matching: 60 }) });

    const pager = screen.getByRole("navigation", { name: "Pages" });
    expect(within(pager).queryByRole("link", { name: /Previous/ })).toBeNull();
    expect(within(pager).getByText("Previous").closest("[aria-disabled='true']")).not.toBeNull();
    expect(within(pager).getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/customers?page=2&size=25");
  });

  it("leaves the pager out when everything fits on one page, but still counts the rows", () => {
    table();

    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    expect(screen.getByText("Showing 1–2 of 2 customers")).toBeInTheDocument();
  });
});

describe("DataTableSkeleton", () => {
  it("is the same panel, header and footer, so nothing moves when the rows arrive", () => {
    const { container } = render(<DataTableSkeleton label="Customer list" columns={columns} />);

    const panel = container.firstElementChild as HTMLElement;
    expect(panel).toHaveClass("flex", "flex-col", "overflow-hidden");
    expect(panel.className).toMatch(/\bh-\[clamp\(/);
    expect(panel.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(10);
    // The same grid templates as the real header.
    expect(panel.querySelector("[style*='--cols-sm']")).not.toBeNull();
    expect(panel.querySelector("a, button, input")).toBeNull();
  });

  it("draws a square tile where a column leads with one, for things rather than people", () => {
    const { container } = render(
      <DataTableSkeleton label="Product list" columns={[{ ...(columns[0] as DataColumn<Row>), lead: "tile" }]} rows={2} />,
    );

    const tiles = container.querySelectorAll('[data-slot="skeleton"].size-9');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveClass("rounded-md");
    expect(tiles[0]).not.toHaveClass("rounded-full");
  });

  it("draws the monogram disc where a column leads with one, and every row at the height the real rows have", () => {
    const { container } = render(<DataTableSkeleton label="Customer list" columns={columns} rows={3} />);

    const discs = container.querySelectorAll('[data-slot="skeleton"].rounded-full');
    expect(discs).toHaveLength(3);
    expect(discs[0]).toHaveClass("size-9");
    const bodyRows = container.querySelectorAll("[style*='--cols-sm'] > div:not(:first-child)");
    expect(bodyRows).toHaveLength(3);
    for (const row of bodyRows) expect(row).toHaveClass("min-h-16");
  });
});
