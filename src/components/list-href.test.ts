import { describe, expect, it } from "vitest";
import { keptSize, listHref, pagedHref, sizeParam } from "./list-href";

describe("listHref", () => {
  it("leaves out empty params", () => {
    expect(listHref("/customers", { q: null, status: undefined, page: "" })).toBe("/customers");
    expect(listHref("/customers", { q: "ana", status: "archived" })).toBe("/customers?q=ana&status=archived");
  });
});

describe("pagedHref", () => {
  const hrefFor = pagedHref("/customers", { q: "ana", status: "archived" }, 50);

  it("goes to another page, keeping the search, the view and the page size", () => {
    expect(hrefFor({ page: 3 })).toBe("/customers?q=ana&status=archived&page=3&size=50");
  });

  it("starts again at page 1 when the size changes, and leaves out a size that is the default", () => {
    expect(hrefFor({ size: 10 })).toBe("/customers?q=ana&status=archived&size=10");
    expect(hrefFor({ size: 25 })).toBe("/customers?q=ana&status=archived");
  });

  it("leaves out page 1 and the default size", () => {
    expect(pagedHref("/payments", {}, 25)({ page: 1 })).toBe("/payments");
    expect(pagedHref("/payments", {}, 25)({})).toBe("/payments");
  });
});

describe("the page size in a list's other links", () => {
  it("is carried by tabs and the search, except when it is the default", () => {
    expect(sizeParam(50)).toBe(50);
    expect(sizeParam(25)).toBeNull();
    expect(keptSize(50)).toBe("50");
    expect(keptSize(25)).toBeUndefined();
  });
});
