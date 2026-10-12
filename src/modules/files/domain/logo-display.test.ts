import { describe, expect, it } from "vitest";
import { fitLogo, LOGO_BOXES, logoLooksExtreme } from "./logo-display";

const box = { width: 192, height: 64 };

describe("fitLogo", () => {
  it("keeps the aspect ratio and fits the box", () => {
    expect(fitLogo({ width: 300, height: 100 }, box)).toEqual({ width: 192, height: 64 });
    expect(fitLogo({ width: 600, height: 300 }, box)).toEqual({ width: 128, height: 64 });
  });

  it("shrinks a very wide logo to the box width instead of overflowing it", () => {
    expect(fitLogo({ width: 600, height: 40 }, box)).toEqual({ width: 192, height: 13 });
  });

  it("shrinks a very tall logo to the box height", () => {
    expect(fitLogo({ width: 40, height: 600 }, box)).toEqual({ width: 4, height: 64 });
  });

  it("never enlarges a small logo", () => {
    expect(fitLogo({ width: 40, height: 30 }, box)).toEqual({ width: 40, height: 30 });
  });

  it("never returns a zero side for an extreme ratio", () => {
    expect(fitLogo({ width: 600, height: 1 }, box)).toEqual({ width: 192, height: 1 });
  });

  it("refuses sizes that can't be a picture", () => {
    expect(fitLogo({ width: 0, height: 50 }, box)).toBeNull();
    expect(fitLogo({ width: 50, height: -1 }, box)).toBeNull();
    expect(fitLogo({ width: Number.NaN, height: 50 }, box)).toBeNull();
    expect(fitLogo({ width: 50, height: 50 }, { width: 0, height: 64 })).toBeNull();
  });

  it("stays inside every box for any size (property)", () => {
    for (const b of Object.values(LOGO_BOXES)) {
      for (let w = 1; w <= 600; w += 37) {
        for (let h = 1; h <= 600; h += 41) {
          const size = fitLogo({ width: w, height: h }, b);
          expect(size).not.toBeNull();
          expect(size!.width).toBeLessThanOrEqual(b.width);
          expect(size!.height).toBeLessThanOrEqual(b.height);
          expect(size!.width).toBeLessThanOrEqual(w);
          expect(size!.height).toBeLessThanOrEqual(h);
          expect(size!.width).toBeGreaterThanOrEqual(1);
          expect(size!.height).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("logoLooksExtreme", () => {
  it("flags logos that will print tiny in the document box", () => {
    expect(logoLooksExtreme({ width: 600, height: 40 })).toBe(true);
    expect(logoLooksExtreme({ width: 40, height: 600 })).toBe(true);
  });

  it("accepts ordinary logos", () => {
    expect(logoLooksExtreme({ width: 400, height: 150 })).toBe(false);
    expect(logoLooksExtreme({ width: 200, height: 200 })).toBe(false);
  });
});
