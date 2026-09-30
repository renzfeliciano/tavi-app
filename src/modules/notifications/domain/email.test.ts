import { describe, expect, it } from "vitest";
import { fromHeader } from "./email";

describe("fromHeader", () => {
  it("keeps the configured sender when no display name is given", () => {
    expect(fromHeader("Tavi <notify@tavi.example>", undefined)).toBe("Tavi <notify@tavi.example>");
  });

  it("shows the business as the sender name, on the configured address", () => {
    expect(fromHeader("Tavi <notify@tavi.example>", "Santos Aircon via Tavi")).toBe(
      '"Santos Aircon via Tavi" <notify@tavi.example>',
    );
    expect(fromHeader("notify@tavi.example", "Santos Aircon via Tavi")).toBe(
      '"Santos Aircon via Tavi" <notify@tavi.example>',
    );
  });

  it("can't be used to inject headers or break the quoting", () => {
    expect(fromHeader("Tavi <n@t.example>", 'Evil"\r\nBcc: x@y.example')).toBe('"Evil Bcc: x@y.example" <n@t.example>');
  });
});
