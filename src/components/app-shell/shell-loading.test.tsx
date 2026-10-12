import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellLoading } from "./shell-loading";

describe("ShellLoading", () => {
  it("announces Loading once and hides the visuals", () => {
    const { container } = render(<ShellLoading />);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelector(".sr-only")?.textContent).toBe("Loading");
    expect(container.querySelector(".page-loader")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("leaves the sidebar's column and centres the loader in the main panel", () => {
    const { container } = render(<ShellLoading />);
    expect(container.querySelector(".lg\\:pl-60")?.className).toContain("lg:[--page-loader-inset:15rem]");
    expect(container.querySelector(".page-loader")?.className).toContain("left-[var(--page-loader-inset,0px)]");
  });
});
