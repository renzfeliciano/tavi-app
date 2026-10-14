import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageHeaderSkeleton, PortalDocumentSkeleton, StatusBadgeSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status/status-badge";

// Layout can't be measured in jsdom, so these pin what the skeleton has to share with the real component;
// the measurement itself, on a real page, is in e2e/customer-record.spec.ts ("holds the strip where the figures will be").

describe("PageHeaderSkeleton", () => {
  it("is the header's own container, so the rule under it and the room around it are where the real ones are", () => {
    const real = render(<PageHeader title="Juan Dela Cruz" description="Their details" actions={<button type="button">Archive</button>} />);
    const realHeader = real.container.querySelector("header");
    const skeleton = render(<PageHeaderSkeleton description="w-72" actions={["w-28"]} />);

    expect(realHeader).not.toBeNull();
    expect(skeleton.container.firstElementChild?.className).toBe(realHeader?.className);
  });

  it("gives the title the line the real title takes: 2rem, and 2.25rem from the large breakpoint", () => {
    const real = render(<PageHeader title="Juan Dela Cruz" />);
    // The title is `text-2xl lg:text-3xl`; a line of text that size is `h-8`, then `lg:h-9`.
    expect(real.container.querySelector("h1")).toHaveClass("text-2xl", "lg:text-3xl");

    const skeleton = render(<PageHeaderSkeleton description={false} />);
    // The header's wrapper, then the block holding the title and description, then the title's line.
    const line = skeleton.container.firstElementChild?.firstElementChild?.firstElementChild;
    expect(line).toHaveClass("h-8", "lg:h-9");
  });

  it("holds the line a status badge makes: the badge is 1.5rem tall, so the line it leads is too", () => {
    const badge = render(<StatusBadge kind="invoice" status="SENT" />).container.firstElementChild;
    expect(badge).toHaveClass("h-6");

    // The header's wrapper, then the block holding the title and description, then the description's first line.
    const firstLine = (container: HTMLElement) => container.firstElementChild?.firstElementChild?.lastElementChild?.firstElementChild;
    const withBadge = render(<PageHeaderSkeleton badge description="w-64" />).container;
    expect(firstLine(withBadge)).toHaveClass("h-6");
    expect(firstLine(withBadge)?.firstElementChild).toHaveClass("h-6");

    // Without one, the description is a plain line of small text: 1.25rem.
    const plain = render(<PageHeaderSkeleton description="w-64" />).container;
    expect(firstLine(plain)).toHaveClass("h-5");
  });
});

describe("StatusBadgeSkeleton", () => {
  it("is as tall as the StatusBadge it stands in for, so the line it sits on does not change height when the badge arrives", () => {
    const badge = render(<StatusBadge kind="quote" status="SENT" />).container.firstElementChild;
    const skeleton = render(<StatusBadgeSkeleton />).container.firstElementChild;

    expect(badge).toHaveClass("h-6", "rounded-full");
    expect(skeleton).toHaveClass("h-6", "rounded-full");
  });

  it("stands in for the badge on a shared document's page, which shows a StatusBadge", () => {
    const { container } = render(<PortalDocumentSkeleton label="Loading the quotation" />);

    expect(container.querySelector(".rounded-full")).toHaveClass("h-6");
  });
});
