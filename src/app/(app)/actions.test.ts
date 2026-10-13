import { beforeEach, describe, expect, it, vi } from "vitest";
import { switchBusiness } from "./actions";

// Switching business changes who every screen belongs to. The sidebar, the page
// the person lands on and every page already visited in this tab are drawn from
// the business that was active, and Next keeps layouts and visited pages in the
// browser. Unless the switch tells Next to forget them, the other business's
// name, customers and prices stay on screen until a reload.

const calls = vi.hoisted(() => [] as string[]);
const activateOrganization = vi.hoisted(() => vi.fn(async () => void calls.push("activate")));
const listMyBusinesses = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn((...args: unknown[]) => void calls.push(`revalidate ${args.join(" ")}`)));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    calls.push(`redirect ${to}`);
    throw new Error("NEXT_REDIRECT"); // Next's redirect() ends the action by throwing
  }),
);

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/identity", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "user-1" }, session: { id: "session-1" } })),
  activateOrganization,
  signOutCurrentSession: vi.fn(),
}));
vi.mock("@/modules/organizations", () => ({ listMyBusinesses }));

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  listMyBusinesses.mockResolvedValue([{ organizationId: "org-1" }, { organizationId: "org-2" }]);
});

describe("switchBusiness", () => {
  it("moves the session to the chosen business, makes Next forget the pages drawn for the old one, then opens the dashboard", async () => {
    await expect(switchBusiness("org-2")).rejects.toThrow("NEXT_REDIRECT");

    expect(activateOrganization).toHaveBeenCalledWith("session-1", "org-2");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(calls).toEqual(["activate", "revalidate / layout", "redirect /dashboard"]);
  });

  it("never switches to a business the person isn't in, whatever id is sent", async () => {
    await expect(switchBusiness("org-of-someone-else")).rejects.toThrow("NEXT_REDIRECT");

    expect(activateOrganization).not.toHaveBeenCalled();
    expect(calls).toEqual(["redirect /dashboard"]);
  });
});
