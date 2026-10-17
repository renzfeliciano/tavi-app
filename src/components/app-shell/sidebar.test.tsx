import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ShellAccount } from "./account";
import type { ShellFacts } from "./facts";
import { SidebarBody } from "./sidebar-body";
import { SHELL_ID } from "./sidebar-state";
import { todayLines } from "./today-card";

let pathname = "/invoices";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/app/theme-actions", () => ({ setTheme: vi.fn(async () => ({ ok: true })) }));

const account: ShellAccount = {
  organizationName: "Santos Aircon Services",
  organizationCategory: "home_services",
  businesses: [
    { id: "a", name: "Santos Aircon Services", current: true },
    { id: "b", name: "Santos Printing", current: false },
  ],
  userName: "Maria Santos",
  userEmail: "maria@example.com",
  canReadReports: true,
  documents: {
    quote: { singular: "Quotation", plural: "Quotations" }, invoice: { singular: "Billing statement", plural: "Billing statements" },
  },
};

const facts: ShellFacts = {
  overdueCount: 3,
  draftCount: 2,
  unpaid: [{ currency: "PHP", outstandingMinor: 1250000, overdueMinor: 400000 }],
  deadline: null,
  note: { mood: "concerned", message: "3 billing statements are past due.", action: { label: "Review them", href: "/invoices" } },
};

const NEW_ACCOUNT: ShellFacts = {
  overdueCount: 0,
  draftCount: 0,
  unpaid: [],
  deadline: null,
  note: { mood: "curious", message: "Add your first customer.", action: { label: "Add customer", href: "/customers/new" } },
};

async function renderSidebar(value: ShellFacts = facts, variant: "desktop" | "drawer" = "desktop") {
  // A promise that has already landed, the way a streamed server promise reads once it has arrived.
  const promise = Object.assign(Promise.resolve(value), { status: "fulfilled" as const, value });
  const view = render(
    <TooltipProvider>
      <div id={SHELL_ID} data-sidebar="expanded" className="group/shell">
        <Suspense fallback={null}>
          <SidebarBody
            account={account}
            facts={promise}
            showNote
            variant={variant}
            signOutAction={async () => {}}
            switchAction={async () => {}}
          />
        </Suspense>
      </div>
    </TooltipProvider>,
  );
  // Let the streamed facts land (the badges and the Today card read them with `use`).
  await act(async () => {
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
}

/** Opens a Base UI menu or popover the way a mouse does. */
async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.pointerDown(element, { button: 0, pointerType: "mouse" });
    fireEvent.mouseDown(element, { button: 0 });
    fireEvent.pointerUp(element, { button: 0, pointerType: "mouse" });
    fireEvent.mouseUp(element, { button: 0 });
    fireEvent.click(element, { button: 0 });
  });
}

beforeEach(() => {
  pathname = "/invoices";
});
afterEach(() => vi.clearAllMocks());

describe("sidebar", () => {
  it("groups the links into Sales and Manage, worded the way the market names documents", async () => {
    await renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("heading", { name: "Sales" })).toBeVisible();
    expect(within(nav).getByRole("heading", { name: "Manage" })).toBeVisible();
    for (const name of ["Dashboard", /^Quotations/, /^Billing statements/, "Payments", "Customers", "Products & Services", "Reports"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(nav).not.toHaveTextContent(/invoice/i);
    // Settings is in the account menu, not listed twice.
    expect(within(nav).queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("marks exactly one page as current", async () => {
    await renderSidebar();
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Billing statements");
  });

  it("shows real counts beside the links and says them aloud", async () => {
    await renderSidebar();
    expect(await screen.findByRole("link", { name: "Billing statements, 3 overdue" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Quotations, 2 drafts" })).toBeInTheDocument();
  });

  it("shows no counts for a new business", async () => {
    await renderSidebar(NEW_ACCOUNT);
    expect(screen.getByRole("link", { name: "Billing statements" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quotations" })).toBeInTheDocument();
  });

  it("has a Today card with the Stamp's line and the figures, and degrades to just the line for a new business", async () => {
    const { unmount } = await renderSidebar();
    const today = screen.getByRole("region", { name: "Today" });
    await waitFor(() => expect(today).toHaveTextContent("3 billing statements are past due."));
    expect(within(today).getByText("Overdue billing statements").nextSibling).toHaveTextContent("3");
    expect(today).toHaveTextContent("₱12,500.00");
    unmount();

    await renderSidebar(NEW_ACCOUNT);
    const fresh = screen.getByRole("region", { name: "Today" });
    await waitFor(() => expect(fresh).toHaveTextContent("Add your first customer."));
    expect(within(fresh).queryByRole("term")).toBeNull();
  });

  it("keeps the email out of the foot of the sidebar, in the menu behind the name", async () => {
    await renderSidebar();
    expect(screen.queryByText("maria@example.com")).toBeNull();
    await press(screen.getByRole("button", { name: /Maria Santos/ }));
    expect(await screen.findByText("maria@example.com")).toBeVisible();
    const menu = screen.getByRole("dialog");
    expect(within(menu).getByRole("link", { name: "Settings" })).toBeVisible();
    expect(within(menu).getByRole("radiogroup", { name: "Theme" })).toBeVisible();
    expect(within(menu).getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  it("offers every business and a way to add another from the name at the top", async () => {
    await renderSidebar();
    await press(screen.getByRole("button", { name: /Santos Aircon Services/ }));
    expect(await screen.findByRole("menuitem", { name: /Santos Printing/ })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Add business/ })).toHaveAttribute("href", "/onboarding?new=1");
  });

  it("opens New with the six things you can start", async () => {
    await renderSidebar();
    await press(screen.getByRole("button", { name: "New" }));
    const labels = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
    expect(labels).toEqual([
      expect.stringContaining("New quotation"),
      expect.stringContaining("New billing statement"),
      expect.stringContaining("New receipt"),
      expect.stringContaining("Add customer"),
      expect.stringContaining("Product"),
      expect.stringContaining("Service"),
    ]);
  });

  it("collapses and expands from the toggle, telling assistive tech which", async () => {
    await renderSidebar();
    const toggle = screen.getByRole("button", { name: /Collapse/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(document.getElementById(SHELL_ID)).toHaveAttribute("data-sidebar", "collapsed");
    expect(screen.getByRole("button", { name: /Collapse/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("the drawer variant has no collapse control: it is always the full sidebar", async () => {
    await renderSidebar(facts, "drawer");
    expect(screen.queryByRole("button", { name: /Collapse/ })).toBeNull();
  });
});

describe("todayLines", () => {
  it("lists only what is real: nothing for a business with no overdue, drafts or unpaid", () => {
    expect(todayLines(NEW_ACCOUNT, account.documents)).toEqual([]);
    expect(todayLines({ ...NEW_ACCOUNT, unpaid: null }, account.documents)).toEqual([]);
  });

  it("never sums across currencies", () => {
    const lines = todayLines(
      { ...facts, overdueCount: 0, draftCount: 0, unpaid: [{ currency: "PHP", outstandingMinor: 100, overdueMinor: 0 }, { currency: "USD", outstandingMinor: 200, overdueMinor: 0 }] },
      account.documents,
    );
    expect(lines.map((l) => l.value)).toEqual(["₱1.00", "$2.00"]);
  });
});
