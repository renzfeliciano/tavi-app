import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortalSignoff } from "./portal-signoff";

describe("PortalSignoff", () => {
  it("signs a customer link with the TAVI wordmark alone, no stamp logo before it", () => {
    const { container } = render(<PortalSignoff />);

    expect(screen.getByRole("contentinfo")).toHaveTextContent("Sent with");
    expect(screen.getByRole("img", { name: "TAVI" })).toBeInTheDocument();
    // The only drawing is the wordmark's own check-mark V.
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
