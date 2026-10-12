import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentQrCode } from "./payment-qr";

describe("PaymentQrCode", () => {
  it("draws the code as an SVG named for the account, on a light plate", () => {
    const { container } = render(<PaymentQrCode value="https://pay.example/a" label="GCash" />);
    const svg = screen.getByRole("img", { name: "GCash QR code" });
    expect(svg.getAttribute("viewBox")).toMatch(/^0 0 (\d+) \1$/);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
    expect(container.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });

  it("draws the same code for the same text", () => {
    const a = render(<PaymentQrCode value="x" label="A" />).container.innerHTML;
    const b = render(<PaymentQrCode value="x" label="A" />).container.innerHTML;
    expect(a).toBe(b);
  });
});
