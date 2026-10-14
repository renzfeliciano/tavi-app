import { describe, expect, it } from "vitest";
import { type CustomerChange, latestActivity } from "./activity";

const at = (iso: string) => new Date(iso);
const change = (customerId: string, iso: string): CustomerChange => ({ customerId, at: at(iso) });

describe("a customer's latest activity", () => {
  it("is the most recent change across quotations and billing statements, and says which kind it was", () => {
    const latest = latestActivity([
      { kind: "invoice", changes: [change("juan", "2026-10-02T00:00:00Z"), change("maria", "2026-09-01T00:00:00Z")] },
      { kind: "quote", changes: [change("juan", "2026-10-05T00:00:00Z"), change("pedro", "2026-08-01T00:00:00Z")] },
    ]);

    expect(latest.get("juan")).toEqual({ at: at("2026-10-05T00:00:00Z"), kind: "quote" });
    expect(latest.get("maria")).toEqual({ at: at("2026-09-01T00:00:00Z"), kind: "invoice" });
    expect(latest.get("pedro")).toEqual({ at: at("2026-08-01T00:00:00Z"), kind: "quote" });
  });

  it("leaves out a customer nothing has happened with", () => {
    const latest = latestActivity([{ kind: "invoice", changes: [] }, { kind: "quote", changes: [] }]);
    expect(latest.size).toBe(0);
    expect(latest.get("juan")).toBeUndefined();
  });

  it("prefers the earlier source when two changes are at the same moment", () => {
    const same = "2026-10-02T00:00:00Z";
    const latest = latestActivity([
      { kind: "invoice", changes: [change("juan", same)] },
      { kind: "quote", changes: [change("juan", same)] },
    ]);
    expect(latest.get("juan")?.kind).toBe("invoice");
  });

  it("keeps the latest when one source lists a customer more than once", () => {
    const latest = latestActivity([
      { kind: "quote", changes: [change("juan", "2026-10-01T00:00:00Z"), change("juan", "2026-10-03T00:00:00Z")] },
    ]);
    expect(latest.get("juan")?.at).toEqual(at("2026-10-03T00:00:00Z"));
  });
});
