import { beforeEach, describe, expect, it, vi } from "vitest";
import { inviteMemberAction } from "./actions";

const ctx = vi.hoisted(() => ({ organizationId: "org-1", userId: "user-1" }));
const inviteMember = vi.hoisted(() => vi.fn());
const flushOutboxAfterResponse = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/shared/env", () => ({ env: { APP_URL: "https://tavi.example" } }));
vi.mock("@/modules/identity", () => ({ requireOrgContext: vi.fn().mockResolvedValue(ctx) }));
vi.mock("@/modules/organizations", () => ({ inviteMember }));
vi.mock("@/modules/notifications", () => ({ flushOutboxAfterResponse }));

beforeEach(() => vi.clearAllMocks());

describe("inviteMemberAction", () => {
  it("sends the queued invitation email right after the response, like every other email command", async () => {
    inviteMember.mockResolvedValue({ ok: true, email: "ana@example.com", resent: false });

    await inviteMemberAction({ email: "ana@example.com", role: "admin" });

    expect(inviteMember).toHaveBeenCalledWith(ctx, { email: "ana@example.com", role: "admin" }, { appUrl: "https://tavi.example" });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/team");
    expect(flushOutboxAfterResponse).toHaveBeenCalledTimes(1);
  });

  it("has nothing to send when the invitation is refused", async () => {
    inviteMember.mockResolvedValue({ ok: false, fieldErrors: { email: ["This person is already in your team."] } });

    await inviteMemberAction({ email: "ana@example.com", role: "admin" });

    expect(flushOutboxAfterResponse).not.toHaveBeenCalled();
  });
});
