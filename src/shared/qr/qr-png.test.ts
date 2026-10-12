import { describe, expect, it } from "vitest";
import { qrPng } from "./qr-png";

describe("qrPng", () => {
  it("is a PNG, larger for a larger scale", async () => {
    const small = await qrPng("HELLO", { scale: 4 });
    const big = await qrPng("HELLO", { scale: 8 });
    expect(small.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // IHDR width: (21 modules + 2 * 2 margin) * scale
    expect(small.readUInt32BE(16)).toBe(25 * 4);
    expect(big.readUInt32BE(16)).toBe(25 * 8);
  });
});
