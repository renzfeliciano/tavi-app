import { describe, expect, it } from "vitest";
import { canDrawQr, qrMatrix, qrPath } from "./qr-matrix";

describe("qrMatrix", () => {
  it("draws a version 1 code (21 modules) for a short value, with the three finder patterns", () => {
    const m = qrMatrix("HELLO");
    expect(m.size).toBe(21);
    for (const [r, c] of [[0, 0], [0, 6], [6, 0], [6, 6], [0, 14], [0, 20], [14, 0], [20, 0]] as const) {
      expect(m.isDark(r, c), `corner ${r},${c}`).toBe(true);
    }
    expect(m.isDark(1, 1)).toBe(false); // the light ring inside the finder
    expect(m.isDark(3, 3)).toBe(true); // its dark centre
  });

  it("grows with the content and is the same every time", () => {
    const long = "https://pay.example.com/" + "a".repeat(200);
    expect(qrMatrix(long).size).toBeGreaterThan(21);
    expect(qrMatrix(long).size).toBe(qrMatrix(long).size);
    const a = qrPath(qrMatrix(long));
    const b = qrPath(qrMatrix(long));
    expect(a).toEqual(b);
  });
});

describe("qrPath", () => {
  it("is one SVG path of horizontal runs, with the matrix size beside it", () => {
    const m = qrMatrix("HELLO");
    const { d, size } = qrPath(m);
    expect(size).toBe(21);
    expect(d).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
    // Runs merge: the top row's first finder bar is one 7-module run, not seven squares.
    expect(d.startsWith("M0 0h7v1h-7z")).toBe(true);
  });

  it("covers exactly the dark modules", () => {
    const m = qrMatrix("TAVI");
    const { d } = qrPath(m);
    let dark = 0;
    for (const run of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) dark += Number(run[3]);
    let expected = 0;
    for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) if (m.isDark(r, c)) expected++;
    expect(dark).toBe(expected);
  });
});

describe("canDrawQr", () => {
  it("says whether the text fits in a code", () => {
    expect(canDrawQr("https://pay.example/a")).toBe(true);
    expect(canDrawQr("a".repeat(5000))).toBe(false);
  });
});
