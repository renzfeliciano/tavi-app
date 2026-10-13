import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import { DEFAULT_MARKET, MARKETS } from "@/config/markets";
import Home from "./page";

vi.mock("@/app/theme-actions", () => ({ setTheme: vi.fn(async () => ({ ok: true })) }));

const market = MARKETS[DEFAULT_MARKET];

describe("Home", () => {
  it("makes the primary tagline its one heading", () => {
    render(<Home />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(brand.taglines.primary);
  });

  it("shows the TAVI wordmark alone in the header, linking home: the Stamp keeps the footer", () => {
    render(<Home />);

    const banner = screen.getByRole("banner");
    expect(banner.querySelector(".mascot")).toBeNull();
    expect(within(banner).getByRole("link", { name: `${brand.name} home` })).toHaveAttribute("href", "/");
    expect(within(banner).getByRole("img", { name: brand.wordmark })).toBeInTheDocument();
  });

  it("offers sign-in and account creation from the header, the first screen and the end", () => {
    render(<Home />);

    expect(within(screen.getByRole("banner")).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/sign-up");
    // The first screen, the closing card, and the bar kept at the foot of a phone's screen.
    const create = screen.getAllByRole("link", { name: "Create an account" });
    expect(create).toHaveLength(3);
    for (const link of create) expect(link).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "#how-it-works");
  });

  it("keeps the header in view as the page scrolls", () => {
    render(<Home />);

    expect(screen.getByRole("banner")).toHaveClass("sticky", "top-0");
  });

  it("keeps a Create an account bar at the foot of a phone's screen, and out of the way from the tablet up", () => {
    render(<Home />);

    const links = screen.getAllByRole("link", { name: "Create an account" });
    const dock = links[links.length - 1]!.closest(".home-dock");
    expect(dock).not.toBeNull();
    expect(dock).toHaveClass("sticky", "bottom-0", "md:hidden");
    expect(links[links.length - 1]).toHaveAttribute("href", "/sign-up");
  });

  it("keeps the Stamp company in every section, each in a mood that fits it", () => {
    render(<Home />);

    const moods: [string, string][] = [
      ["From job to paid in three steps", "curious"],
      ["Send it the way your customers read it", "happy"],
      ["And the rest of the job", "resting"],
      ["Simple software for the way small businesses work", "neutral"],
      [`Send your first ${market.documents.quote.singular.toLowerCase()} today`, "celebrating"],
    ];
    for (const [heading, expression] of moods) {
      const section = screen.getByRole("heading", { level: 2, name: heading }).closest("section")!;
      const stamps = section.querySelectorAll(".mascot");
      expect(stamps, heading).toHaveLength(1);
      expect(stamps[0], heading).toHaveAttribute("data-expression", expression);
      // Decoration only: every section says what it says in words.
      expect(stamps[0], heading).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("sets the Stamp on a light chip where the page goes violet, so its ink body is not lost", () => {
    render(<Home />);

    const band = screen.getByRole("heading", { level: 2, name: "Simple software for the way small businesses work" }).closest("section")!;
    expect(band.querySelector('div[data-theme="light"] .mascot')).not.toBeNull();
  });

  it("ends on the Stamp: the closing card is stamped Paid, and the Stamp celebrates above the button", () => {
    render(<Home />);

    const section = screen
      .getByRole("heading", { level: 2, name: `Send your first ${market.documents.quote.singular.toLowerCase()} today` })
      .closest("section")!;
    // The statement says it in its status and in the imprint the Stamp leaves.
    expect(within(section).getAllByText("Paid").length).toBeGreaterThanOrEqual(2);
    expect(section.querySelector(".home-cta-sheet .home-cta-imprint")).toHaveTextContent("Paid");
    expect(within(section).getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
    // The same moments, in words, that the imprint stands for.
    expect(within(section).getByText("Payment recorded")).toBeInTheDocument();
  });

  it("ends with a way back to the top, watching the footer for when the end is reached", () => {
    render(<Home />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveAttribute("id", "page-end");
    // Hidden from assistive technology until the end is in view (there is no scrolling here).
    expect(screen.getByText("Back to top").closest("a")).toHaveAttribute("href", "#top");
  });

  it("explains the path in three numbered steps, in the market's own words", () => {
    render(<Home />);

    const section = screen.getByRole("heading", { level: 2, name: "From job to paid in three steps" }).closest("section")!;
    const steps = within(section).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(`Make the ${market.documents.quote.singular.toLowerCase()}`);
    expect(steps[1]).toHaveTextContent(market.shareChannels);
    expect(steps[2]).toHaveTextContent(market.documents.invoice.singular.toLowerCase());
  });

  it("pictures each step: the quotation's rows, the two ways to send it, and a downpayment with the balance left", () => {
    render(<Home />);

    const section = screen.getByRole("heading", { level: 2, name: "From job to paid in three steps" }).closest("section")!;
    const steps = within(section).getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Appliance repair");
    expect(steps[0]).toHaveTextContent("Total");
    expect(steps[1]).toHaveTextContent("Email it");
    expect(steps[1]).toHaveTextContent("Copy link");
    expect(steps[2]).toHaveTextContent("Downpayment");
    expect(steps[2]).toHaveTextContent("Balance");
    // The last step carries the check, as the sign-in screens' flow does.
    expect(steps[2]?.querySelector("svg.lucide-check")).not.toBeNull();
    expect(steps[0]?.querySelector("svg.lucide-check")).toBeNull();
  });

  it("shows a sample quotation, labelled as one, with figures that add up", () => {
    render(<Home />);

    const figure = screen.getByRole("figure");
    expect(within(figure).getByText(/^A sample quotation\./)).toBeInTheDocument();
    const table = within(figure).getByRole("table");
    const amounts = within(table)
      .getAllByRole("cell")
      .map((cell) => cell.querySelector("data")?.getAttribute("value"))
      .filter((value): value is string => Boolean(value));
    expect(amounts).toEqual(["2400.00 PHP", "1500.00 PHP", "600.00 PHP", "4500.00 PHP"]);
  });

  it("shows the quotation's terms with a downpayment of half the total, and a row discount already taken off", () => {
    render(<Home />);

    const figure = screen.getByRole("figure");
    expect(within(figure).getByText("Terms")).toBeInTheDocument();
    expect(within(figure).getByText(/50% downpayment \(₱2,250\.00\) to start the job/)).toBeInTheDocument();
    expect(within(figure).getByText("Discount −₱100.00")).toBeInTheDocument();
    expect(within(figure).getByText(/Ordered once the downpayment is in/)).toBeInTheDocument();
  });

  it("shows how a document goes out: the email, the PDF and the link, in plain words", () => {
    render(<Home />);

    const section = screen.getByRole("heading", { level: 2, name: "Send it the way your customers read it" }).closest("section")!;
    const cards = within(section).getAllByRole("listitem");
    expect(cards.map((card) => within(card).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Email it",
      "A PDF for your files",
      "Or share the link",
    ]);

    // What the email looks like when it lands: from the business, with the way in.
    const email = cards[0]!;
    expect(within(email).getByText("Quotation QUO-000012 from Renzo Feliciano Payod Repair Services")).toBeInTheDocument();
    expect(within(email).getByText("View and approve")).toBeInTheDocument();
    expect(within(email).getByText(/Replies go straight to your inbox/)).toBeInTheDocument();

    // The PDF is named for every document the market has, not just the quotation.
    const pdf = cards[1]!;
    for (const name of [market.documents.quote, market.documents.invoice, market.documents.receipt]) {
      expect(pdf).toHaveTextContent(name.singular.toLowerCase());
    }

    // The link is for the chat apps, and the customer can decline as well as approve.
    expect(cards[2]).toHaveTextContent(market.shareChannels);
    expect(cards[2]).toHaveTextContent(/approve or decline/i);
  });

  it("lists the rest of the job: payments in parts, scan to pay, reports, saved details, the recycle bin and revisions", () => {
    render(<Home />);

    const section = screen.getByRole("heading", { level: 2, name: "And the rest of the job" }).closest("section")!;
    const titles = within(section)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Downpayments and part-payments",
      "Scan to pay",
      "Reports for your accountant",
      "Customers and a price list",
      "Revise without starting over",
      "A recycle bin",
    ]);
  });

  it("keeps to what is true today: no prices, no customer claims, nothing about BIR", () => {
    const { container } = render(<Home />);

    expect(container.textContent).not.toMatch(/₱\s?\d[\d,]*\s?(\/|per)\s?(month|mo|year)|free|trusted by|testimonial|customers use|BIR|official receipt/i);
    expect(screen.getByText(/does not give tax or accounting advice/)).toBeInTheDocument();
  });

  it("links the Terms of Service and Privacy Notice", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
  });

  describe("the footer", () => {
    it("is signed by the Stamp, not a second wordmark, and says what Tavi is", () => {
      render(<Home />);

      const footer = screen.getByRole("contentinfo");
      // The wordmark is the header's; the footer has the Stamp, standing on its check.
      expect(within(footer).queryByRole("img", { name: brand.wordmark })).toBeNull();
      const stamp = footer.querySelector(".mascot");
      expect(stamp).toHaveAttribute("data-expression", "happy");
      expect(stamp?.querySelector('path[d^="M23.5 79"]')).not.toBeNull();
      expect(footer).toHaveTextContent(brand.taglines.primary);
      expect(within(footer).getByText(/payment records for small businesses/)).toBeInTheDocument();
      expect(footer).toHaveTextContent("does not give tax or accounting advice");
    });

    it("lists where to go: the sections of this page, how to start, and the legal pages", () => {
      render(<Home />);

      const footer = screen.getByRole("contentinfo");
      const product = within(footer).getByRole("navigation", { name: "Product" });
      expect(within(product).getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
      expect(within(product).getByRole("link", { name: "Send it your way" })).toHaveAttribute("href", "#send");
      expect(within(product).getByRole("link", { name: "The rest of the job" })).toHaveAttribute("href", "#rest");

      const start = within(footer).getByRole("navigation", { name: "Get started" });
      expect(within(start).getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
      expect(within(start).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");

      const legal = within(footer).getByRole("navigation", { name: "Legal" });
      expect(within(legal).getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
      expect(within(legal).getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
    });

    it("points to sections that are on the page", () => {
      const { container } = render(<Home />);

      for (const id of ["how-it-works", "send", "rest"]) expect(container.querySelector(`#${id}`), id).not.toBeNull();
    });

    it("has the small print: who it is by, and who it is for", () => {
      render(<Home />);

      const footer = screen.getByRole("contentinfo");
      expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} ${brand.name}`);
      expect(within(footer).getByText("Built for small businesses in the Philippines")).toBeInTheDocument();
    });
  });
});
