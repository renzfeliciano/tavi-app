import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ShellAccount } from "./account";
import type { ShellFacts } from "./facts";
import { SidebarBody } from "./sidebar-body";
import { SHELL_ID } from "./sidebar-state";

vi.mock("next/navigation", () => ({ usePathname: () => "/quotes" }));
vi.mock("@/app/theme-actions", () => ({ setTheme: vi.fn(async () => ({ ok: true })) }));

// The collapsed sidebar shows icons only. Each icon is wrapped in a tooltip
// (CollapsedTip) that names it. A menu or popover opens from the same button,
// and it positions itself against that button: if the button is rebuilt when
// the menu opens, the menu is left anchored to a button that is no longer on
// the page and lands in the top-left corner of the screen.

const account: ShellAccount = {
  organizationName: "Travis Renz's Repair Shop",
  organizationCategory: "home_services",
  businesses: [{ id: "a", name: "Travis Renz's Repair Shop", current: true }],
  userName: "Travis Renz's Repair Shop",
  userEmail: "travis@example.com",
  canReadReports: true,
  canRecordPayments: true,
  canWritePurchasing: true,
  documents: {
    quote: { singular: "Quotation", plural: "Quotations" }, invoice: { singular: "Billing statement", plural: "Billing statements" },
    purchaseOrder: { singular: "Purchase order", plural: "Purchase orders" },
  },
};

const facts: ShellFacts = {
  overdueCount: 0,
  draftCount: 1,
  unpaid: [],
  deadline: null,
  note: { mood: "curious", message: "Add your first customer.", action: { label: "Add customer", href: "/customers/new" } },
};

async function renderSidebar(state: "collapsed" | "expanded") {
  const promise = Object.assign(Promise.resolve(facts), { status: "fulfilled" as const, value: facts });
  const view = render(
    <TooltipProvider>
      <div id={SHELL_ID} data-sidebar={state} className="group/shell">
        <Suspense fallback={null}>
          <SidebarBody
            account={account}
            facts={promise}
            showNote
            variant="desktop"
            signOutAction={async () => {}}
            switchAction={async () => {}}
          />
        </Suspense>
      </div>
    </TooltipProvider>,
  );
  await act(async () => {
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
}

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.pointerDown(element, { button: 0, pointerType: "mouse" });
    fireEvent.mouseDown(element, { button: 0 });
    fireEvent.pointerUp(element, { button: 0, pointerType: "mouse" });
    fireEvent.mouseUp(element, { button: 0 });
    fireEvent.click(element, { button: 0 });
  });
}

afterEach(() => vi.clearAllMocks());

describe("collapsed sidebar menus", () => {
  it("keeps the account button on the page when its popup opens, so the popup stays anchored to it", async () => {
    await renderSidebar("collapsed");
    const button = screen.getByRole("button", { name: /account menu/ });

    await press(button);

    expect(await screen.findByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(button.isConnected).toBe(true);
    expect(screen.getByRole("button", { name: /account menu/ })).toBe(button);
  });

  it("keeps the New button on the page when its menu opens", async () => {
    await renderSidebar("collapsed");
    const button = screen.getByRole("button", { name: /^New/ });

    await press(button);

    expect(await screen.findByRole("menuitem", { name: /New quotation/ })).toBeInTheDocument();
    expect(button.isConnected).toBe(true);
    expect(screen.getByRole("button", { name: /^New/ })).toBe(button);
  });
});

// A long account name used to push the "Ctrl B" hint out of the sidebar, and a
// laptop-height window used to cut the Today card off behind a chunky scrollbar.
// Layout can't be measured in jsdom, so these pin the classes that fix it; the
// measurements themselves are checked in a real browser (e2e/app-shell.spec.ts).
describe("sidebar fit", () => {
  it("gives the foot one column that can shrink, so a long account name can't push the shortcut hint out", async () => {
    await renderSidebar("expanded");

    const foot = screen.getByRole("button", { name: /^Collapse/ }).parentElement;

    expect(foot).toHaveClass("grid-cols-[minmax(0,1fr)]");
  });

  it("scrolls the links and Today with a slim scrollbar when a window is too short for both", async () => {
    await renderSidebar("expanded");

    const scroller = screen.getByRole("navigation", { name: "Main" }).parentElement;

    expect(scroller).toHaveClass("overflow-y-auto", "[scrollbar-width:thin]");
  });

  it("tightens the rows and drops Today's figures on a short window, so everything fits without scrolling", async () => {
    await renderSidebar("expanded");

    expect(screen.getByRole("link", { name: /^Dashboard/ })).toHaveClass("short:h-6.5");
    const figures = screen.getByText("Draft quotations").closest("dl");
    expect(figures).toHaveClass("short:hidden");
  });

  it("defines a short window as a laptop-height screen with a mouse, never a phone", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("@custom-variant short (@media (max-height: 800px) and (pointer: fine));");
  });
});
