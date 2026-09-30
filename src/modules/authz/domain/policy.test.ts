import { describe, expect, it } from "vitest";
import {
  assertCan,
  can,
  CAPABILITIES,
  capabilitiesFor,
  ForbiddenError,
  ROLES,
  type Capability,
} from "./policy";

const ctx = (role: (typeof ROLES)[number]) => ({ role });

describe("role matrix (docs/foundation-proposal.md §E)", () => {
  it("gives owners every capability", () => {
    expect([...capabilitiesFor("owner")].sort()).toEqual([...CAPABILITIES].sort());
  });

  it("keeps billing, org deletion and ownership transfer owner-only", () => {
    for (const cap of ["billing.manage", "organization.delete", "ownership.transfer"] as const) {
      expect(can(ctx("owner"), cap)).toBe(true);
      expect(can(ctx("admin"), cap)).toBe(false);
      expect(can(ctx("member"), cap)).toBe(false);
    }
  });

  it("lets admins manage the organization and money corrections", () => {
    for (const cap of [
      "organization.manage",
      "users.manage",
      "audit.read",
      "invoices.void",
      "payments.record",
      "payments.void",
    ] as const) {
      expect(can(ctx("admin"), cap)).toBe(true);
      expect(can(ctx("member"), cap)).toBe(false);
    }
  });

  it("lets members do the everyday quote-to-invoice work", () => {
    const everyday: Capability[] = [
      "customers.read",
      "customers.write",
      "catalog.read",
      "catalog.write",
      "quotes.read",
      "quotes.write",
      "quotes.send",
      "quotes.decide",
      "invoices.read",
      "invoices.write",
      "invoices.send",
      "payments.read",
    ];
    for (const cap of everyday) expect(can(ctx("member"), cap)).toBe(true);
  });

  it("matches the documented matrix exactly", () => {
    expect(
      Object.fromEntries(ROLES.map((role) => [role, [...capabilitiesFor(role)].sort()])),
    ).toMatchSnapshot();
  });
});

describe("assertCan", () => {
  it("passes silently when allowed", () => {
    expect(() => assertCan(ctx("member"), "quotes.send")).not.toThrow();
  });

  it("throws a ForbiddenError naming the capability", () => {
    expect(() => assertCan(ctx("member"), "payments.void")).toThrow(ForbiddenError);
    expect(() => assertCan(ctx("member"), "payments.void")).toThrow(/payments\.void/);
  });
});
