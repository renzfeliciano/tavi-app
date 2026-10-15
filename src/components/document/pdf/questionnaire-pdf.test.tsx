// @vitest-environment node
import { renderToBuffer } from "@react-pdf/renderer";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { registerPdfFonts } from "./document-pdf";
import { QuestionnairePdf, type QuestionnairePdfProps } from "./questionnaire-pdf";

const props: QuestionnairePdfProps = {
  title: "Questions for your RDO or accountant",
  answerLabel: "Answer from your RDO or accountant",
  business: { name: "Santos Aircon", taxId: { label: "VAT Reg TIN", value: "123-456-789-00000" }, office: { label: "RDO code", value: "044" } },
  preparedOn: "October 15, 2026",
  facts: [
    { label: "Your sales in the last 12 months", answer: "Under ₱3 million" },
    { label: "How you issue invoices today", answer: null },
  ],
  questions: [
    { number: 1, text: "Must I register Tavi as my invoicing system?", context: "Tavi prints billing statements until you enter a registration.", note: "Bring the COR", answer: null, answeredOn: null },
    { number: 2, text: "Am I required to e-invoice?", context: "Tavi can download structured data.", note: null, answer: "Not until your sales pass the threshold.", answeredOn: "October 10, 2026" },
  ],
};

/** Every element under `node`, with our own components expanded (they are plain functions, no hooks). */
function elementsIn(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  if (Array.isArray(node)) return node.flatMap(elementsIn);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  const below = typeof node.type === "function" ? (node.type as (p: object) => ReactNode)(node.props) : node.props.children;
  return [node, ...elementsIn(below)];
}
const words = (element: ReactElement) =>
  elementsIn(element)
    .flatMap((e) => (Array.isArray(e.props.children) ? e.props.children : [e.props.children]))
    .flatMap((child) => (typeof child === "string" ? [child] : typeof child === "number" ? [String(child)] : []))
    .join("\n");

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("QuestionnairePdf", () => {
  it("names the business, its TIN and RDO code, and when it was prepared", () => {
    const text = words(<QuestionnairePdf {...props} />);
    expect(text).toContain("Santos Aircon");
    expect(text).toContain("VAT Reg TIN 123-456-789-00000");
    expect(text).toContain("RDO code 044");
    expect(text).toContain("October 15, 2026");
  });

  it("prints each fact, with 'Not answered' for a blank one", () => {
    const text = words(<QuestionnairePdf {...props} />);
    expect(text).toContain("Under ₱3 million");
    expect(text).toContain("How you issue invoices today");
    expect(text).toContain("Not answered");
  });

  it("prints every question numbered, with its note and the answer received", () => {
    const text = words(<QuestionnairePdf {...props} />);
    expect(text).toContain("Must I register Tavi as my invoicing system?");
    expect(text).toContain("Bring the COR");
    expect(text).toContain("Not until your sales pass the threshold.");
    expect(text).toContain("Told on October 10, 2026");
  });

  it("leaves lines to write on when a question has no answer yet", () => {
    const text = words(<QuestionnairePdf {...props} />);
    expect(text).toContain("Answer from your RDO or accountant");
  });

  it("prints the heading and the answer label it is given, not wording of its own", () => {
    const text = words(<QuestionnairePdf {...props} business={{ ...props.business, office: null }} title="Questions for your tax agent" answerLabel="Their reply" />);
    expect(text).toContain("Questions for your tax agent");
    expect(text).toContain("Their reply");
    expect(text).not.toContain("RDO");
  });

  it("says it is not legal or tax advice", () => {
    expect(words(<QuestionnairePdf {...props} />)).toContain("Prepared with Tavi. Not legal or tax advice.");
  });

  it("leaves the TIN and RDO blank when the business has not set them", () => {
    const text = words(<QuestionnairePdf {...props} business={{ name: "Santos Aircon", taxId: null, office: null }} />);
    expect(text).toContain("Santos Aircon");
    expect(text).not.toContain("VAT Reg TIN");
  });

  it("renders a real PDF, and breaks a long worksheet across pages instead of cutting it off", async () => {
    registerPdfFonts();
    const small = await renderToBuffer(<QuestionnairePdf {...props} />);
    expect(small.subarray(0, 5).toString()).toBe("%PDF-");
    const long = "A very long note that keeps going. ".repeat(60);
    const many = Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      text: `Question ${i + 1}?`,
      context: "Context.",
      note: long,
      answer: long,
      answeredOn: "October 10, 2026",
    }));
    const big = await renderToBuffer(<QuestionnairePdf {...props} questions={many} />);
    expect(pageCount(big)).toBeGreaterThan(1);
  });
});
