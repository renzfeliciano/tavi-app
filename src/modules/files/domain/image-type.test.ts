import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

describe("detectImageType", () => {
  it("recognizes PNG, JPEG and WebP by their signatures", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
  });

  it("rejects SVG, GIF, PDFs and anything else, whatever the file is called", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(detectImageType(svg)).toBeNull();
    expect(detectImageType(bytes(0x47, 0x49, 0x46, 0x38))).toBeNull();
    expect(detectImageType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
