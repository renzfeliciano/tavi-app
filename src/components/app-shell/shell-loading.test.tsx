import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellChromeFallback } from "./shell-loading";

describe("ShellChromeFallback", () => {
  it("is decorative: no text, nothing to announce, focus or click", () => {
    const { container } = render(<ShellChromeFallback />);
    expect(container.textContent).toBe("");
    expect(container.querySelectorAll('[role="status"], a, button, [tabindex]')).toHaveLength(0);
    for (const frame of container.children) expect(frame).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the sidebar's column on desktop and the top bar's height on phones", () => {
    const { container } = render(<ShellChromeFallback />);
    const [sidebar, topBar] = Array.from(container.children);
    expect(sidebar).toHaveClass("fixed", "w-(--sidebar-w)", "hidden", "lg:flex");
    expect(topBar).toHaveClass("sticky", "h-14", "lg:hidden");
  });

  it("has the sidebar's shape: the three nav groups (1 + 3 + 4 rows), the Today card and the person", () => {
    const { container } = render(<ShellChromeFallback />);
    const [sidebar] = Array.from(container.children);
    // 8 nav rows + the collapse row + the user row = 10 rows with an icon-sized block.
    expect(sidebar!.querySelectorAll(".h-9.items-center").length).toBe(9);
    expect(sidebar!.querySelectorAll(".rounded-full")).toHaveLength(1);
  });
});
