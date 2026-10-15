import { describe, expect, it } from "vitest";
import { addRecipient } from "./recipients";

describe("addRecipient", () => {
  it("adds a typed address, lower-cased and trimmed", () => {
    expect(addRecipient(" Ana@Example.com ", [], [])).toEqual({ ok: true, extras: ["ana@example.com"] });
  });

  it("leaves the list alone when nothing is typed", () => {
    expect(addRecipient("   ", ["ana@example.com"], [])).toEqual({ ok: true, extras: ["ana@example.com"] });
  });

  it("doesn't add an address twice, or one that is already in the fixed list", () => {
    expect(addRecipient("ana@example.com", ["ana@example.com"], [])).toEqual({ ok: true, extras: ["ana@example.com"] });
    expect(addRecipient("maria@example.com", [], ["maria@example.com"])).toEqual({ ok: true, extras: [] });
  });

  it("refuses an address that isn't one", () => {
    expect(addRecipient("not-an-email", [], [])).toMatchObject({ ok: false, error: expect.stringContaining("isn't a valid email") });
  });

  it("refuses a sixth person, counting the fixed ones", () => {
    const extras = ["a@example.com", "b@example.com", "c@example.com", "d@example.com"];
    expect(addRecipient("e@example.com", extras, [])).toEqual({ ok: true, extras: [...extras, "e@example.com"] });
    expect(addRecipient("f@example.com", extras, ["x@example.com"])).toMatchObject({ ok: false, error: expect.stringContaining("5 people") });
  });
});
