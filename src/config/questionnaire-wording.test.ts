import { describe, expect, it } from "vitest";
import { MARKET_CODES, MARKETS } from "./markets";

// The RDO/CPA worksheet's wording comes from the market profile (D12).
describe.each(MARKET_CODES)("%s questionnaire wording", (code) => {
  const market = MARKETS[code];
  const questionnaire = market.registration?.questionnaire;

  it("lists facts and questions with unique codes", () => {
    if (!market.registration) return;
    expect(questionnaire).toBeDefined();
    const factCodes = questionnaire!.facts.map((f) => f.code);
    const questionCodes = questionnaire!.questions.map((q) => q.code);
    expect(new Set(factCodes).size).toBe(factCodes.length);
    expect(new Set(questionCodes).size).toBe(questionCodes.length);
  });

  it("words its own title, intro, row summary, visit prompt and PDF headings", () => {
    if (!market.registration) return;
    for (const key of ["title", "intro", "rowSummary", "visitPrompt", "pdfTitle", "answerLabel"] as const) {
      expect(questionnaire![key].trim(), key).not.toBe("");
    }
  });

  it("gives every fact a label and at least two options with unique codes", () => {
    for (const fact of questionnaire?.facts ?? []) {
      expect(fact.label.trim()).not.toBe("");
      expect(fact.options.length).toBeGreaterThanOrEqual(2);
      const codes = fact.options.map((o) => o.code);
      expect(new Set(codes).size).toBe(codes.length);
      for (const option of fact.options) expect(option.label.trim()).not.toBe("");
    }
  });

  it("gives every question its wording and one line of context", () => {
    for (const question of questionnaire?.questions ?? []) {
      expect(question.text.trim()).not.toBe("");
      expect(question.context.trim()).not.toBe("");
    }
  });
});

describe("PH questionnaire wording", () => {
  const questionnaire = MARKETS.PH.registration!.questionnaire;

  it("asks four facts and six questions", () => {
    expect(questionnaire.facts.map((f) => f.code)).toEqual(["salesBand", "invoicingNow", "sellsOnline", "customersWithhold"]);
    expect(questionnaire.questions.map((q) => q.code)).toEqual([
      "registerSystem",
      "eInvoiceDuty",
      "onlineSeller",
      "quotationNotice",
      "correctInvoice",
      "withholding",
    ]);
  });

  it("builds the quotation question from the market's supplementary notice", () => {
    const question = questionnaire.questions.find((q) => q.code === "quotationNotice")!;
    expect(question.text).toContain(MARKETS.PH.supplementaryDocumentNotice);
  });
});
