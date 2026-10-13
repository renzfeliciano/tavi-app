import { describe, expect, it } from "vitest";
import { KIND_LABEL, KIND_TABS, startingKind } from "./kinds";

describe("the catalog's tabs", () => {
  it("come in the order of the page's title, Products & Services", () => {
    expect(KIND_TABS).toEqual(["product", "service"]);
    expect(KIND_TABS.map((kind) => KIND_LABEL[kind].plural)).toEqual(["Products", "Services"]);
  });
});

describe("startingKind", () => {
  it("opens on Products, the first tab, when the business has products", () => {
    expect(startingKind({ product: 3, service: 0 })).toBe("product");
    expect(startingKind({ product: 3, service: 5 })).toBe("product");
  });

  it("opens on Services when that is all the business has, so it doesn't land on an empty tab", () => {
    expect(startingKind({ product: 0, service: 4 })).toBe("service");
  });

  it("opens on the first tab when the catalog is empty", () => {
    expect(startingKind({ product: 0, service: 0 })).toBe("product");
  });
});
