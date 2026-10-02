import { describe, expect, it } from "vitest";
import {
  canManageMember,
  invitationInputSchema,
  invitationReturnPath,
  invitationState,
  sameEmail,
  TEAM_LIMITS,
} from "./team";

describe("invitationInputSchema", () => {
  it("lowercases and trims the email", () => {
    expect(invitationInputSchema.parse({ email: "  Ana@Example.COM ", role: "member" })).toEqual({
      email: "ana@example.com",
      role: "member",
    });
  });

  it.each([
    [{ email: "", role: "member" }, "Enter their email address."],
    [{ email: "not an email", role: "member" }, "Enter a valid email address."],
    [{ email: "ana@example.com", role: "owner" }, "Choose a role."],
    [{ email: `${"a".repeat(TEAM_LIMITS.email)}@x.co`, role: "admin" }, "Use 254 characters or fewer."],
  ])("explains %j", (input, message) => {
    const result = invitationInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("invitationState", () => {
  const now = new Date("2026-10-02T00:00:00Z");
  const base = { expiresAt: new Date("2026-10-09T00:00:00Z"), acceptedAt: null, revokedAt: null };

  it.each([
    ["open", base],
    ["expired", { ...base, expiresAt: now }],
    ["accepted", { ...base, acceptedAt: now, expiresAt: now }],
    ["cancelled", { ...base, revokedAt: now }],
  ] as const)("is %s", (state, invitation) => {
    expect(invitationState(invitation, now)).toBe(state);
  });
});

describe("sameEmail", () => {
  it("ignores case and surrounding spaces", () => {
    expect(sameEmail(" Ana@Example.com", "ana@example.com")).toBe(true);
    expect(sameEmail("ana@example.com", "ana@example.org")).toBe(false);
  });
});

describe("canManageMember", () => {
  const actor = { userId: "u1" };
  it("manages other admins and members", () => {
    expect(canManageMember(actor, { userId: "u2", role: "admin" })).toBe(true);
    expect(canManageMember(actor, { userId: "u2", role: "member" })).toBe(true);
  });
  it("never the owner, never yourself", () => {
    expect(canManageMember(actor, { userId: "u2", role: "owner" })).toBe(false);
    expect(canManageMember(actor, { userId: "u1", role: "admin" })).toBe(false);
  });
});

describe("invitationReturnPath", () => {
  const token = "A".repeat(43);
  it("goes back to a well-formed invitation", () => {
    expect(invitationReturnPath(token)).toBe(`/invite/${token}`);
  });
  it.each([undefined, "", "https://evil.example", "/dashboard", `${token}/../x`, ["a"]])("ignores %j", (value) => {
    expect(invitationReturnPath(value)).toBeNull();
  });
});
