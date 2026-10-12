import { describe, expect, it } from "vitest";
import { TRASH_RETENTION_DAYS, trashDaysLeft, trashExpiry, trashKindCapability, TRASH_KINDS } from "./trash";

describe("trashExpiry", () => {
  it("keeps a deleted draft for the retention period", () => {
    const deleted = new Date("2026-10-01T02:00:00Z");
    expect(trashExpiry(deleted).toISOString()).toBe("2026-10-31T02:00:00.000Z");
    expect(TRASH_RETENTION_DAYS).toBe(30);
  });
});

describe("trashDaysLeft", () => {
  const expires = new Date("2026-10-31T02:00:00Z");

  it("counts whole days left, rounding a part day up", () => {
    expect(trashDaysLeft(expires, new Date("2026-10-01T02:00:00Z"))).toBe(30);
    expect(trashDaysLeft(expires, new Date("2026-10-30T20:00:00Z"))).toBe(1);
  });

  it("never goes below zero", () => {
    expect(trashDaysLeft(expires, new Date("2026-11-05T00:00:00Z"))).toBe(0);
  });
});

describe("trashKindCapability", () => {
  it("restoring needs the same capability as writing that kind of document", () => {
    expect(TRASH_KINDS).toEqual(["invoice", "quote"]);
    expect(trashKindCapability("invoice")).toBe("invoices.write");
    expect(trashKindCapability("quote")).toBe("quotes.write");
  });
});
