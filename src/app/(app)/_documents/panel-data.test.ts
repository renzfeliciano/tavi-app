import { describe, expect, it } from "vitest";
import { activity, dueNote, panelCustomer, validNote } from "./panel-data";

const snapshot = { displayName: "Juan Dela Cruz", company: "Dela Cruz Bakery", email: "juan@bakery.example", phone: "0917 555 0100", addressLines: [], taxId: null };
const day = (iso: string) => new Date(`${iso}T02:00:00Z`);
const format = (date: Date) => date.toISOString().slice(0, 10);

describe("the customer on a document's side panel", () => {
  it("is the customer as the document was issued to them, linked to their record, with how to reach them", () => {
    expect(panelCustomer(snapshot, "c1")).toEqual({
      name: "Juan Dela Cruz",
      company: "Dela Cruz Bakery",
      email: "juan@bakery.example",
      phone: "0917 555 0100",
      href: "/customers/c1",
    });
  });

  it("has no link once the document is no longer attached to a customer record", () => {
    expect(panelCustomer(snapshot, null)?.href).toBeNull();
  });

  it("is nothing for a document with no customer on it", () => {
    expect(panelCustomer(null, "c1")).toBeNull();
  });
});

describe("a document's activity", () => {
  it("lists what happened oldest first, whatever order it is given in, and leaves out what hasn't happened", () => {
    const events = activity(
      [
        { key: "edited", label: "Updated", at: day("2026-10-08") },
        { key: "sent", label: "Sent", at: day("2026-10-01") },
        { key: "viewed", label: "Opened by the customer", at: day("2026-10-03") },
        { key: "voided", label: "Voided", at: null },
      ],
      format,
    );
    expect(events).toEqual([
      { key: "sent", label: "Sent", on: "2026-10-01" },
      { key: "viewed", label: "Opened by the customer", on: "2026-10-03" },
      { key: "edited", label: "Updated", on: "2026-10-08" },
    ]);
  });

  it("keeps the given order for things that happened at the same moment", () => {
    const at = day("2026-10-01");
    const events = activity(
      [
        { key: "a", label: "Sent", at },
        { key: "b", label: "Opened by the customer", at },
      ],
      format,
    );
    expect(events.map((event) => event.key)).toEqual(["a", "b"]);
  });

  it("carries a reason or note under the event it belongs to, and drops a blank one", () => {
    const events = activity(
      [
        { key: "voided", label: "Voided", at: day("2026-10-05"), detail: "Wrong unit price" },
        { key: "cancelled", label: "Cancelled", at: day("2026-10-06"), detail: "  " },
      ],
      format,
    );
    expect(events[0]).toEqual({ key: "voided", label: "Voided", on: "2026-10-05", detail: "Wrong unit price" });
    expect(events[1]).not.toHaveProperty("detail");
  });
});

describe("how near a due date is", () => {
  it.each([
    [5, "in 5 days"],
    [2, "in 2 days"],
    [1, "tomorrow"],
    [0, "today"],
    [-1, "1 day overdue"],
    [-10, "10 days overdue"],
  ])("%i days from now reads %s", (days, words) => {
    expect(dueNote(days)).toBe(words);
  });
});

describe("how long a quotation stays open", () => {
  it.each([
    [14, "14 days left"],
    [1, "1 day left"],
    [0, "last day"],
    [-1, "expired yesterday"],
    [-9, "expired 9 days ago"],
  ])("%i days from now reads %s", (days, words) => {
    expect(validNote(days)).toBe(words);
  });
});
