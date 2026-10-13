import { readFileSync } from "node:fs";
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
  const html = () => brandSignoffHtml("https://tavi.example", "Sent with");

  it("shows the TAVI wordmark alone from the app, with alt text", () => {
    expect(html()).toContain('<img src="https://tavi.example/icons/tavi-email-wordmark.png" alt="Tavi"');
    expect(html()).toContain("Sent with");
  });
  it("reads as one line, 'Sent with' and the wordmark side by side, not the wordmark under the words", () => {
    const line = html();

    expect(line).not.toContain("<br");
    expect(line).not.toContain("display:block");
    expect(line).toMatch(/Sent with <img /);
    expect(line.match(/<p /g)).toHaveLength(1);
  });
  it("sits on the words' baseline, so the letters line up with them", () => {
    expect(html()).toMatch(/style="[^"]*vertical-align:-\d+px/);
  });
  it("points at a picture that exists, drawn at a third of its pixel size so it stays sharp on 3x screens", () => {
    const png = readFileSync("public/icons/tavi-email-wordmark.png");
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];

    expect(width % 3).toBe(0);
    expect(height % 3).toBe(0);
    expect(html()).toContain(`width="${width / 3}" height="${height / 3}"`);
  });
  it("is small enough to sit in a line of 12px text", () => {
    const png = readFileSync("public/icons/tavi-email-wordmark.png");

    expect(png.readUInt32BE(20) / 3).toBeLessThanOrEqual(24);
  });
  it("falls back to the name in text when there is no address to load it from", () => {
    const text = brandSignoffHtml(null, "Sent with");
    expect(text).not.toContain("<img");
    expect(text).toContain("Sent with Tavi");
  });
});
