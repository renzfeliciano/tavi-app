import { describe, expect, it } from "vitest";
import { decodeQrPixels } from "./qr-decode";
import { qrMatrix } from "./qr-matrix";

/** A screenshot-like RGBA bitmap of a code: `scale` pixels per module, a light margin around it. */
function bitmap(value: string, scale: number, { invert = false, margin = 4 } = {}) {
  const m = qrMatrix(value);
  const side = (m.size + margin * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const row = Math.floor(y / scale) - margin;
      const col = Math.floor(x / scale) - margin;
      const dark = row >= 0 && col >= 0 && row < m.size && col < m.size && m.isDark(row, col);
      const v = dark !== invert ? 0 : 255;
      const i = (y * side + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: side, height: side };
}

const PAYLOAD = "00020101021128620011ph.ppmi.p2m0111BNORPHMMXXX0315SANTOS AIRCON5204581253036085802PH5913SANTOS AIRCON6004CITY6304";

describe("decodeQrPixels", () => {
  it("reads the text back out of a link QR", () => {
    const { data, width, height } = bitmap("https://pay.example/santos", 6);
    expect(decodeQrPixels(data, width, height)).toBe("https://pay.example/santos");
  });

  it("reads a long payload with spaces", () => {
    const { data, width, height } = bitmap(PAYLOAD + "ABCD", 5);
    expect(decodeQrPixels(data, width, height)).toBe(PAYLOAD + "ABCD");
  });

  it("reads a light-on-dark (dark mode screenshot) code", () => {
    const { data, width, height } = bitmap("https://pay.example/santos", 6, { invert: true });
    expect(decodeQrPixels(data, width, height)).toBe("https://pay.example/santos");
  });

  it("finds nothing in a picture with no code", () => {
    const data = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    expect(decodeQrPixels(data, 100, 100)).toBeNull();
  });
});
