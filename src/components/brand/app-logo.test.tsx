import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLogo } from "./app-logo";

describe("AppLogo", () => {
  it("is TAVI's stamp logo, named for screen readers, at the size asked", () => {
    render(<AppLogo size={44} />);
    const img = screen.getByRole("img", { name: "TAVI" });
    expect(img.getAttribute("width")).toBe("44");
    expect(img.getAttribute("height")).toBe("44");
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain("/icons/tavi-stamp.png");
  });
});
