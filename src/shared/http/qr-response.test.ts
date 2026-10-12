import { describe, expect, it } from "vitest";
import { pickQr, qrImageResponse } from "./qr-response";

describe("pickQr", () => {
  const qrs = ["a", "b"];
  it("finds a QR by its position", () => {
    expect(pickQr(qrs, "0")).toBe("a");
    expect(pickQr(qrs, "1")).toBe("b");
  });
  it("finds nothing past the end or for anything but a single digit", () => {
    for (const n of ["2", "-1", "01", "1.5", "a", "", "9", "1e0"]) expect(pickQr(qrs, n), n).toBeNull();
  });
});

describe("qrImageResponse", () => {
  it("is a private, uncached PNG", async () => {
    const response = await qrImageResponse("https://pay.example/a");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  });
});
