import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Route } from "next";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListPager, ListSearch, ListViews, PageSizeLinks } from "./list-controls";
import { ListPending, ListResults } from "./list-pending";

// A tab, a page link or a search on a list changes only the query string, so
// Next keeps the old list on screen until the new one has arrived and never
// shows the page's loading.tsx. These pieces fill that gap: the controls report
// that a navigation is on its way, and ListResults puts the list's skeleton in
// place of the old rows once it has been waiting long enough to notice.

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// Next reports a link's navigation through useLinkStatus; the tests flip it by hand.
const link = vi.hoisted(() => ({ pending: false }));
vi.mock("next/link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/link")>()),
  useLinkStatus: () => link,
}));

const Skeleton = () => <p>Rows on their way</p>;

function Page({ children }: { children?: ReactNode }) {
  return (
    <ListPending>
      <ListViews
        label="Status"
        views={[
          { href: "/quotes" as Route, label: "All", current: true },
          { href: "/quotes?status=draft" as Route, label: "Draft", current: false },
        ]}
      />
      {children}
      <ListResults label="Loading quotations" skeleton={<Skeleton />}>
        <p>Quote rows</p>
        <ListPager page={2} pageCount={5} hrefFor={(page) => `/quotes?page=${page}` as Route} />
      </ListResults>
    </ListPending>
  );
}

const SLOW = 150;
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  link.pending = false;
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ListResults", () => {
  it("shows the rows, and no skeleton, when nothing is on its way", async () => {
    render(<Page />);
    await wait(1000);

    expect(screen.getByText("Quote rows")).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the rows when used outside ListPending", () => {
    render(
      <ListResults label="Loading quotations" skeleton={<Skeleton />}>
        <p>Quote rows</p>
      </ListResults>,
    );

    expect(screen.getByText("Quote rows")).toBeVisible();
  });

  it("keeps the old rows for a quick navigation, so a fast click doesn't flash a skeleton", async () => {
    const view = render(<Page />);
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW - 1);

    expect(screen.getByText("Quote rows")).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("swaps the rows for the skeleton once a navigation is slow, and announces it", async () => {
    const view = render(<Page />);
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading quotations");
    expect(status).toHaveTextContent("Rows on their way");
    expect(screen.queryByText("Quote rows")).not.toBeVisible();
  });

  it("hides the skeleton's bars from screen readers, which hear the label once", async () => {
    const view = render(<Page />);
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW);

    expect(screen.getByText("Rows on their way").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("brings the new rows back when the navigation is done", async () => {
    const view = render(<Page />);
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW);
    link.pending = false;
    view.rerender(<Page />);

    expect(screen.getByText("Quote rows")).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the links mounted while the skeleton shows, so the one that was clicked can finish reporting", async () => {
    const view = render(<Page />);
    const next = screen.getByRole("link", { name: /Next/ });
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW);

    expect(next.isConnected).toBe(true);
    expect(screen.getByRole("link", { name: /Next/, hidden: true })).toBe(next);
  });

  it("waits the full delay again for the next navigation", async () => {
    const view = render(<Page />);
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW);
    link.pending = false;
    view.rerender(<Page />);

    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW - 1);

    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the controls", () => {
  it("count a tab being opened as a navigation on its way", async () => {
    const view = render(<Page />);
    link.pending = true;
    view.rerender(<Page />);
    await wait(SLOW);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("leave the tabs as plain links, with the current one marked", () => {
    render(<Page />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Draft" })).toHaveAttribute("href", "/quotes?status=draft");
  });
});

describe("ListSearch", () => {
  const search = (extra: Parameters<typeof ListSearch>[0]["keep"] = {}, value: string | null = null) => (
    <ListSearch action={"/quotes" as Route} label="Search quotations" placeholder="Number or customer" value={value} keep={extra} />
  );
  const submit = (text: string) => {
    const input = screen.getByRole("searchbox", { name: "Search quotations" });
    fireEvent.change(input, { target: { value: text } });
    // A real browser sends the submit event; the default action would reload the whole page.
    const prevented = !fireEvent.submit(input.closest("form") as HTMLFormElement);
    return prevented;
  };

  it("goes to the search through the router, so the page isn't reloaded", () => {
    render(<Page>{search()}</Page>);

    const prevented = submit("Grace");

    expect(prevented).toBe(true);
    expect(router.push).toHaveBeenCalledWith("/quotes?q=Grace");
  });

  it("keeps the view being searched, and leaves out what is empty", () => {
    render(<Page>{search({ status: "draft", type: undefined })}</Page>);

    submit("Grace Santos");

    expect(router.push).toHaveBeenCalledWith("/quotes?q=Grace+Santos&status=draft");
  });

  it("clears the search when it is submitted empty", () => {
    render(<Page>{search({ status: "draft" }, "Grace")}</Page>);

    submit("");

    expect(router.push).toHaveBeenCalledWith("/quotes?status=draft");
  });

  it("still works as a plain form without JavaScript", () => {
    render(<Page>{search({ status: "draft" })}</Page>);

    const form = screen.getByRole("search");

    expect(form).toHaveAttribute("action", "/quotes");
    expect(form.querySelector('input[name="status"]')).toHaveValue("draft");
  });
});

describe("page links", () => {
  const click = (name: RegExp | string, init: MouseEventInit = {}) =>
    fireEvent.click(screen.getByRole("link", { name }), init);

  it("go to the page through the router on a plain click, so the page isn't reloaded", () => {
    render(<Page />);

    const notPrevented = click(/Next/);

    expect(notPrevented).toBe(false);
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/quotes?page=3");
  });

  it("leave a click with a modifier key to the browser, which opens a new tab", () => {
    render(<Page />);

    const notPrevented = click(/Next/, { ctrlKey: true });

    expect(notPrevented).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("collapse a burst of clicks into the first and the last, never the ones between", async () => {
    render(<Page />);

    click(/Next/);
    click(/Previous/);
    click(/Next/);
    click(/Previous/);
    expect(router.push.mock.calls).toEqual([["/quotes?page=3"]]);

    await wait(300);
    expect(router.push.mock.calls).toEqual([["/quotes?page=3"], ["/quotes?page=1"]]);
  });

  it("let the next click straight through once the burst has settled", async () => {
    render(<Page />);
    click(/Next/);
    await wait(1000);

    click(/Previous/);

    expect(router.push.mock.calls).toEqual([["/quotes?page=3"], ["/quotes?page=1"]]);
  });

  it("show the list busy while a click is waiting its turn", async () => {
    render(<Page />);
    click(/Next/);
    click(/Previous/);

    expect(screen.getByText("Quote rows").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    await wait(300);
    expect(screen.getByText("Quote rows").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  });

  it("mark the current page size and keep the sizes as plain links", () => {
    render(
      <ListPending>
        <PageSizeLinks pageSize={25} hrefFor={({ size }) => `/quotes?size=${size}` as Route} />
      </ListPending>,
    );

    expect(screen.getByRole("link", { name: "50" })).toHaveAttribute("href", "/quotes?size=50");
    expect(screen.getByRole("link", { name: "25" })).toHaveAttribute("aria-current", "true");
    click("100");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/quotes?size=100");
  });
});

describe("ListSearch as you type", () => {
  const box = () => screen.getByRole("searchbox", { name: "Search quotations" });
  const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
  const enter = () => fireEvent.submit(box().closest("form") as HTMLFormElement);
  const search = (value: string | null = null, keep: Record<string, string | undefined> = {}) => (
    <Page>
      <ListSearch action={"/quotes" as Route} label="Search quotations" placeholder="Number or customer" value={value} keep={keep} />
    </Page>
  );

  it("waits for a pause in typing, then searches once for the latest text", async () => {
    render(search());

    type("a");
    await wait(100);
    type("an");
    await wait(100);
    type("ana");
    await wait(299);
    expect(router.push).not.toHaveBeenCalled();

    await wait(1);
    expect(router.push.mock.calls).toEqual([["/quotes?q=ana"]]);
  });

  it("keeps the view being searched", async () => {
    render(search(null, { status: "draft" }));

    type("ana");
    await wait(300);

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/quotes?q=ana&status=draft");
  });

  it("makes no request for text that hasn't changed, including after typing a letter and taking it back", async () => {
    render(search());
    type("ana");
    await wait(300);

    type("anab");
    type("ana");
    await wait(300);
    type("  ana ");
    await wait(300);

    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("searches at once on Enter and drops the wait that was running", async () => {
    render(search());

    type("gra");
    enter();
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/quotes?q=gra");

    await wait(1000);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("does nothing on Enter when the text is what is already searched", () => {
    render(search("Grace"));

    enter();

    expect(router.push).not.toHaveBeenCalled();
  });

  it("clears the search once the box has been emptied", async () => {
    render(search("Grace", { status: "draft" }));

    type("");
    await wait(300);

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/quotes?status=draft");
  });
});
