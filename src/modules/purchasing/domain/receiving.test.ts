import { describe, expect, it } from "vitest";
import { PO_LIMITS } from "./limits";
import { parseReceipt, readinessToIssue } from "./receiving";

describe("readinessToIssue", () => {
  it("is ready with a supplier and at least one line", () => {
    expect(readinessToIssue({ supplierId: "x", lineCount: 1 })).toEqual({});
  });

  it("says what is missing, keyed like the form's fields", () => {
    expect(readinessToIssue({ supplierId: null, lineCount: 0 })).toEqual({
      supplierId: "Choose a supplier before issuing.",
      lines: "Add at least one item before issuing.",
    });
  });
});

describe("parseReceipt", () => {
  const context = { orderDate: "2026-10-01", today: "2026-10-10" };

  it("reads a date and an optional note", () => {
    expect(parseReceipt({ receivedDate: "2026-10-09", note: "  2 boxes short " }, context)).toEqual({
      ok: true,
      receipt: { receivedDate: "2026-10-09", note: "2 boxes short" },
    });
    expect(parseReceipt({ receivedDate: "2026-10-10", note: "" }, context)).toEqual({
      ok: true,
      receipt: { receivedDate: "2026-10-10", note: null },
    });
  });

  it("accepts the order date itself", () => {
    expect(parseReceipt({ receivedDate: "2026-10-01", note: "" }, context).ok).toBe(true);
  });

  it("refuses a date that is not real, in the future, or before the order", () => {
    expect(parseReceipt({ receivedDate: "2026-13-01", note: "" }, context)).toEqual({
      ok: false,
      errors: { receivedDate: "Enter a real date." },
    });
    expect(parseReceipt({ receivedDate: "2026-10-11", note: "" }, context)).toEqual({
      ok: false,
      errors: { receivedDate: "Choose today or an earlier date." },
    });
    expect(parseReceipt({ receivedDate: "2026-09-30", note: "" }, context)).toEqual({
      ok: false,
      errors: { receivedDate: "Choose a date on or after the order date." },
    });
  });

  it("refuses a note that is too long", () => {
    expect(parseReceipt({ receivedDate: "2026-10-09", note: "n".repeat(PO_LIMITS.receiptNote + 1) }, context)).toEqual({
      ok: false,
      errors: { note: "Use 500 characters or fewer." },
    });
  });

  it("copes with a garbled payload", () => {
    expect(parseReceipt(undefined, context)).toMatchObject({ ok: false });
  });
});
