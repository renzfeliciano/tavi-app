import { act } from "@testing-library/react";
import { type ReactElement, Suspense } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ShellAccount } from "./account";
import { AppSidebar } from "./app-sidebar";
import { QUIET_NOTE, type ShellFacts } from "./facts";
import { MobileTabBar, MobileTopBar } from "./mobile-nav";
import { SHELL_ID } from "./sidebar-state";
import { VerifyEmailBanner } from "./verify-email-banner";

// The shell's pieces stream in after the page, each in its own Suspense boundary, so they
// hydrate after it. A modal that opens in between (a fast click) makes Base UI mark everything
// outside it `aria-hidden="true"` (and `data-base-ui-inert`) on the server's HTML, before
// React gets to those pieces. That is an outside library editing nodes React has not hydrated
// yet, not a bug in what we render, so each piece's root says so (`suppressHydrationWarning`).
// These tests do what Base UI does and hydrate: no mismatch may be reported, and one anywhere
// else in the piece still is.

vi.mock("next/navigation", () => ({ usePathname: () => "/invoices" }));
vi.mock("@/app/theme-actions", () => ({ setTheme: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { sendVerificationEmail: vi.fn() } }));

const account: ShellAccount = {
  organizationName: "Santos Aircon Services",
  organizationCategory: "home_services",
  businesses: [{ id: "a", name: "Santos Aircon Services", current: true }],
  userName: "Maria Santos",
  userEmail: "maria@example.com",
  canReadReports: true,
  documents: {
    quote: { singular: "Quotation", plural: "Quotations" }, invoice: { singular: "Billing statement", plural: "Billing statements" },
  },
};

const facts: ShellFacts = { overdueCount: 0, draftCount: 0, unpaid: [], deadline: null, note: QUIET_NOTE };
// A promise that has already landed, the way a streamed server promise reads once it has arrived.
const landed = Object.assign(Promise.resolve(facts), { status: "fulfilled" as const, value: facts });

const PIECES: { name: string; element: () => ReactElement; root: string }[] = [
  {
    name: "the sidebar",
    root: "aside",
    element: () => (
      <AppSidebar account={account} facts={landed} showNote={false} signOutAction={async () => {}} switchAction={async () => {}} />
    ),
  },
  { name: "the phone top bar", root: "header", element: () => <MobileTopBar organizationName="Santos Aircon Services" /> },
  { name: "the phone tab bar", root: `#${SHELL_ID} > div`, element: () => <MobileTabBar account={account} /> },
  { name: "the email banner", root: '[role="region"]', element: () => <VerifyEmailBanner email="maria@example.com" /> },
];

function tree(piece: ReactElement) {
  return (
    <TooltipProvider>
      <div id={SHELL_ID} data-sidebar="expanded" className="group/shell">
        <Suspense fallback={null}>{piece}</Suspense>
      </div>
    </TooltipProvider>
  );
}

/** The server's HTML, then what Base UI does to it when a modal opens, then hydration. Returns what React reported. */
async function hydrateAfterModalOpened(piece: ReactElement, mark: (shell: Element) => Element | null) {
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(tree(piece));
  const target = mark(container);
  if (!target) throw new Error("nothing to mark: the piece rendered no such element");
  target.setAttribute("aria-hidden", "true");
  target.setAttribute("data-base-ui-inert", "");

  const reported: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    reported.push(args.map(String).join(" "));
  });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(container, tree(piece), { onRecoverableError: (error) => reported.push(String(error)) });
  });
  spy.mockRestore();
  await act(async () => root?.unmount());
  container.remove();
  return reported.filter((line) => /hydrat|didn't match|did not match/i.test(line));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("shell pieces that stream in after the page", () => {
  it.each(PIECES)("hydrate $name without a mismatch after a modal marked it aria-hidden", async ({ element, root }) => {
    const reported = await hydrateAfterModalOpened(element(), (container) => container.querySelector(root));
    expect(reported).toEqual([]);
  });

  it("still report a mismatch deeper inside a piece (the harness can see one)", async () => {
    const reported = await hydrateAfterModalOpened(<MobileTopBar organizationName="Santos Aircon Services" />, (container) =>
      container.querySelector("header > button"),
    );
    expect(reported.join("\n")).toMatch(/hydrat/i);
  });
});
