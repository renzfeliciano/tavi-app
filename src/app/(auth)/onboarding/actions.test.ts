import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBusiness } from "./actions";

// Adding a business makes it the active one, like switching to it does. The sidebar
// and every page already visited in this tab are drawn from the business that was
// active; unless the action tells Next to forget them, the old business's name,
// customers and prices stay on screen next to the new one's until a reload.

const calls = vi.hoisted(() => [] as string[]);
const activateOrganization = vi.hoisted(() => vi.fn(async () => void calls.push("activate")));
const createOrganizationForUser = vi.hoisted(() => vi.fn());
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
  requireSession: vi.fn(async () => ({ user: { id: "user-1" }, session: { id: "session-1" } })),
  activateOrganization,
}));
vi.mock("@/modules/organizations", () => ({ createOrganizationForUser }));

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const valid = { name: "Second Shop", currency: "PHP", country: "PH", category: "home_services" };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

describe("createBusiness", () => {
  it("makes the new business active, makes Next forget the pages drawn for the old one, then opens its dashboard", async () => {
    createOrganizationForUser.mockResolvedValue({ ok: true, organization: { id: "org-new" } });

    await expect(createBusiness({}, form(valid))).rejects.toThrow("NEXT_REDIRECT");

    expect(activateOrganization).toHaveBeenCalledWith("session-1", "org-new");
    expect(calls).toEqual(["activate", "revalidate / layout", "redirect /dashboard"]);
  });

  it("changes nothing, and returns what was typed, when the form has mistakes", async () => {
    createOrganizationForUser.mockResolvedValue({ ok: false, fieldErrors: { name: ["Enter a name."] } });

    const state = await createBusiness({}, form({ ...valid, name: "" }));

    expect(state.fieldErrors).toEqual({ name: ["Enter a name."] });
    expect(state.values?.currency).toBe("PHP");
    expect(activateOrganization).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
