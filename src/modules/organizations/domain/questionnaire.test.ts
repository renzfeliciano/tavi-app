import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { QUESTIONNAIRE_LIMITS } from "./limits";
import { parseQuestionnaire, questionnaireChanges, questionStatus, readQuestionnaire } from "./questionnaire";

const config = MARKETS.PH.registration!.questionnaire;
const today = "2026-10-15";
const parse = (input: unknown) => parseQuestionnaire(config, input, { today });

describe("parseQuestionnaire", () => {
  it("accepts facts and a recorded answer", () => {
    const result = parse({
      facts: { salesBand: "under_3m", sellsOnline: "yes" },
      questions: { registerSystem: { note: "Ask on Monday", answer: "Yes, file Form 1900", answeredOn: "2026-10-10" } },
    });
    expect(result).toEqual({
      ok: true,
      value: {
        facts: { salesBand: "under_3m", sellsOnline: "yes" },
        questions: { registerSystem: { note: "Ask on Monday", answer: "Yes, file Form 1900", answeredOn: "2026-10-10" } },
      },
    });
  });

  it("treats blanks as not set", () => {
    const result = parse({ facts: { salesBand: "" }, questions: { registerSystem: { note: " ", answer: "", answeredOn: "" } } });
    expect(result).toEqual({ ok: true, value: { facts: {}, questions: {} } });
  });

  it("refuses an option that is not in the list", () => {
    const result = parse({ facts: { salesBand: "a_lot" } });
    expect(result).toEqual({ ok: false, errors: { "facts.salesBand": "Choose an option from the list." } });
  });

  it("refuses a note or an answer over the limit", () => {
    const long = "x".repeat(QUESTIONNAIRE_LIMITS.note + 1);
    const result = parse({ questions: { withholding: { note: long, answer: long, answeredOn: "" } } });
    expect(result).toMatchObject({
      ok: false,
      errors: {
        "questions.withholding.note": "Use 1,000 characters or fewer.",
        "questions.withholding.answer": "Use 1,000 characters or fewer.",
      },
    });
  });

  it("counts a line break once, as the browser's own limit does", () => {
    // A browser counts a typed line break as one character but submits it as two (CRLF).
    const lines = "x\r\n".repeat(QUESTIONNAIRE_LIMITS.answer / 2);
    const result = parse({ questions: { withholding: { note: "", answer: lines, answeredOn: "" } } });
    expect(result.ok && result.value.questions.withholding?.answer).toBe(lines.replaceAll("\r\n", "\n").trim());
  });

  it("refuses a date that is not real or is in the future", () => {
    const bad = parse({ questions: { withholding: { note: "", answer: "Yes", answeredOn: "2026-02-31" } } });
    expect(bad).toMatchObject({ ok: false, errors: { "questions.withholding.answeredOn": "Enter a real date." } });
    const future = parse({ questions: { withholding: { note: "", answer: "Yes", answeredOn: "2026-10-16" } } });
    expect(future).toMatchObject({ ok: false, errors: { "questions.withholding.answeredOn": "That date is in the future." } });
  });

  it("drops a date that has no answer", () => {
    const result = parse({ questions: { withholding: { note: "Ask", answer: "", answeredOn: "2026-10-10" } } });
    expect(result).toEqual({ ok: true, value: { facts: {}, questions: { withholding: { note: "Ask", answer: null, answeredOn: null } } } });
  });

  it("drops codes the market does not list", () => {
    const result = parse({ facts: { shoeSize: "9" }, questions: { gone: { note: "x", answer: null, answeredOn: null } } });
    expect(result).toEqual({ ok: true, value: { facts: {}, questions: {} } });
  });

  it("copes with input that is not an object", () => {
    expect(parse(null)).toEqual({ ok: true, value: { facts: {}, questions: {} } });
    expect(parse({ facts: "x", questions: 3 })).toEqual({ ok: true, value: { facts: {}, questions: {} } });
  });
});

describe("readQuestionnaire", () => {
  it("ignores stored codes and options the market no longer lists", () => {
    const value = readQuestionnaire(
      config,
      { salesBand: "under_3m", old: "x", sellsOnline: "maybe" },
      { registerSystem: { note: "n", answer: null, answeredOn: null }, removed: { note: "n", answer: null, answeredOn: null } },
    );
    expect(value).toEqual({
      facts: { salesBand: "under_3m" },
      questions: { registerSystem: { note: "n", answer: null, answeredOn: null } },
    });
  });

  it("is empty for a business that has saved nothing", () => {
    expect(readQuestionnaire(config, null, null)).toEqual({ facts: {}, questions: {} });
  });
});

describe("questionnaireChanges", () => {
  const before = { facts: { salesBand: "under_3m" }, questions: { registerSystem: { note: "a", answer: null, answeredOn: null } } };

  it("is empty when nothing differs", () => {
    expect(questionnaireChanges(before, structuredClone(before))).toEqual([]);
  });

  it("names the codes that differ, facts and questions", () => {
    const after = {
      facts: { salesBand: "over_20m", sellsOnline: "no" },
      questions: { registerSystem: { note: "a", answer: "Yes", answeredOn: "2026-10-10" } },
    };
    expect(questionnaireChanges(before, after).sort()).toEqual(["registerSystem", "salesBand", "sellsOnline"]);
  });

  it("notices a removed answer", () => {
    expect(questionnaireChanges(before, { facts: {}, questions: before.questions })).toEqual(["salesBand"]);
  });
});

describe("questionStatus", () => {
  it("is answered once an answer is saved", () => {
    expect(questionStatus({ note: null, answer: "Yes", answeredOn: null })).toBe("answered");
    expect(questionStatus({ note: "Ask", answer: null, answeredOn: null })).toBe("not_asked");
    expect(questionStatus(undefined)).toBe("not_asked");
  });
});
