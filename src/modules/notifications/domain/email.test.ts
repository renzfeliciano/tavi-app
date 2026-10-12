import { describe, expect, it } from "vitest";
import { fromHeader, brandSignoffHtml, originOf } from "./email";

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

describe("originOf", () => {
  it("is the address of the app a link points to", () => {
    expect(originOf("https://tavi.example/i/abc123")).toBe("https://tavi.example");
    expect(originOf("http://localhost:3200/q/xyz")).toBe("http://localhost:3200");
  });
  it("is null for anything that isn't a web link", () => {
    expect(originOf("not a url")).toBeNull();
    expect(originOf("javascript:alert(1)")).toBeNull();
  });
});

describe("brandSignoffHtml", () => {
  it("shows the stamp and TAVI lockup from the app, with alt text and its size", () => {
    const html = brandSignoffHtml("https://tavi.example", "Sent with");
    expect(html).toContain('<img src="https://tavi.example/icons/tavi-email-lockup.png" alt="Tavi"');
    expect(html).toContain('width="137" height="66"');
    expect(html).toContain("Sent with");
  });
  it("falls back to the name in text when there is no address to load it from", () => {
    const html = brandSignoffHtml(null, "Sent with");
    expect(html).not.toContain("<img");
    expect(html).toContain("Sent with Tavi");
  });
});
