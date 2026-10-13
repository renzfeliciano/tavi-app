import { beforeEach, describe, expect, it, vi } from "vitest";
import { acceptInvitationAction } from "./actions";

// Accepting an invitation switches the person to the business that invited them,
// so the sidebar and every page already visited in this tab (drawn for the
// business they were in) must be forgotten, as when switching or adding one.

const calls = vi.hoisted(() => [] as string[]);
const activateOrganization = vi.hoisted(() => vi.fn(async () => void calls.push("activate")));
const acceptInvitation = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn((...args: unknown[]) => void calls.push(`revalidate ${args.join(" ")}`)));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    calls.push(`redirect ${to}`);
    throw new Error("NEXT_REDIRECT");
  }),
);

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/identity", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "user-1", email: "a@example.com" }, session: { id: "session-1" } })),
  activateOrganization,
}));
vi.mock("@/modules/organizations", () => ({ acceptInvitation }));

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

describe("acceptInvitationAction", () => {
  it("joins, switches to the inviting business, makes Next forget the old business's pages, then opens its dashboard", async () => {
    acceptInvitation.mockResolvedValue({ ok: true, organizationId: "org-9" });

    await expect(acceptInvitationAction("token")).rejects.toThrow("NEXT_REDIRECT");

    expect(activateOrganization).toHaveBeenCalledWith("session-1", "org-9");
    expect(calls).toEqual(["activate", "revalidate / layout", "redirect /dashboard"]);
  });

  it("explains a wrong address or a used-up invitation, and switches nothing", async () => {
    acceptInvitation.mockResolvedValue({ ok: false, error: "wrong_email" });

    const result = await acceptInvitationAction("token");

    expect(result).toEqual({ ok: false, error: expect.stringContaining("different email address") });
    expect(activateOrganization).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
