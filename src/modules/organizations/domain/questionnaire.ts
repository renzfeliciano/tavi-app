import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { tooLong } from "@/shared/validation/messages";
import { QUESTIONNAIRE_LIMITS as LIMITS } from "./limits";

// The RDO/CPA worksheet: a few facts about the business and a fixed list of
// questions to ask the tax office or an accountant, with a place for the
// owner's note and for the answer they were given. It never changes a
// document, a setting or a tax calculation. Wording comes from
// `market.registration.questionnaire`.

type QuestionnaireConfig = NonNullable<MarketProfile["registration"]>["questionnaire"];

/** What the owner wrote and was told about one question. Each part may be null. */
export type QuestionEntry = { note: string | null; answer: string | null; answeredOn: string | null };

/** What is stored: a chosen option per fact, and an entry per question that has any. */
export type QuestionnaireValue = {
  facts: Record<string, string>;
  questions: Record<string, QuestionEntry>;
};

export type QuestionnaireResult =
  | { ok: true; value: QuestionnaireValue }
  | { ok: false; errors: Record<string, string> };

export const EMPTY_QUESTIONNAIRE: QuestionnaireValue = { facts: {}, questions: {} };

const record = z.record(z.string(), z.unknown());
const asRecord = (value: unknown): Record<string, unknown> => {
  const parsed = record.safeParse(value);
  return parsed.success ? parsed.data : {};
};
// A browser submits a typed line break as CRLF but counts it once toward `maxLength`: count it once here too.
const text = (value: unknown) => (typeof value === "string" ? value.replaceAll("\r\n", "\n").trim() : "");

/**
 * Validates the form. Codes the market doesn't list are dropped; a date with
 * no answer is dropped; `today` is the business's own date.
 */
export function parseQuestionnaire(
  config: QuestionnaireConfig,
  input: unknown,
  { today }: { today: CalendarDate },
): QuestionnaireResult {
  const source = asRecord(input);
  const rawFacts = asRecord(source.facts);
  const rawQuestions = asRecord(source.questions);
  const errors: Record<string, string> = {};

  const facts: Record<string, string> = {};
  for (const fact of config.facts) {
    const value = text(rawFacts[fact.code]);
    if (value === "") continue;
    if (!fact.options.some((option) => option.code === value)) {
      errors[`facts.${fact.code}`] = "Choose an option from the list.";
      continue;
    }
    facts[fact.code] = value;
  }

  const questions: Record<string, QuestionEntry> = {};
  for (const question of config.questions) {
    const entry = asRecord(rawQuestions[question.code]);
    const key = (part: keyof QuestionEntry) => `questions.${question.code}.${part}`;
    const note = text(entry.note);
    const answer = text(entry.answer);
    const answeredOnRaw = text(entry.answeredOn);
    if (note.length > LIMITS.note) errors[key("note")] = tooLong(LIMITS.note);
    if (answer.length > LIMITS.answer) errors[key("answer")] = tooLong(LIMITS.answer);

    let answeredOn: CalendarDate | null = null;
    if (answer !== "" && answeredOnRaw !== "") {
      if (!isCalendarDate(answeredOnRaw)) errors[key("answeredOn")] = "Enter a real date.";
      else if (compareDates(answeredOnRaw, today) > 0) errors[key("answeredOn")] = "That date is in the future.";
      else answeredOn = answeredOnRaw;
    }

    if (note === "" && answer === "") continue;
    questions[question.code] = { note: note === "" ? null : note, answer: answer === "" ? null : answer, answeredOn };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { facts, questions } };
}

/** What was stored, with anything the market no longer lists removed. */
export function readQuestionnaire(config: QuestionnaireConfig, storedFacts: unknown, storedQuestions: unknown): QuestionnaireValue {
  const rawFacts = asRecord(storedFacts);
  const rawQuestions = asRecord(storedQuestions);
  const facts: Record<string, string> = {};
  for (const fact of config.facts) {
    const value = rawFacts[fact.code];
    if (typeof value === "string" && fact.options.some((option) => option.code === value)) facts[fact.code] = value;
  }
  const questions: Record<string, QuestionEntry> = {};
  for (const question of config.questions) {
    const raw = rawQuestions[question.code];
    if (raw === undefined) continue;
    const entry = asRecord(raw);
    const part = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
    const read = { note: part(entry.note), answer: part(entry.answer), answeredOn: part(entry.answeredOn) };
    if (read.note === null && read.answer === null) continue;
    questions[question.code] = read;
  }
  return { facts, questions };
}

/** The codes whose value differs between two worksheets, for the audit log (never the values). */
export function questionnaireChanges(before: QuestionnaireValue, after: QuestionnaireValue): string[] {
  const changed: string[] = [];
  for (const code of new Set([...Object.keys(before.facts), ...Object.keys(after.facts)])) {
    if (before.facts[code] !== after.facts[code]) changed.push(code);
  }
  for (const code of new Set([...Object.keys(before.questions), ...Object.keys(after.questions)])) {
    const a = before.questions[code];
    const b = after.questions[code];
    if (a?.note !== b?.note || a?.answer !== b?.answer || a?.answeredOn !== b?.answeredOn) changed.push(code);
  }
  return changed;
}

export type QuestionStatus = "answered" | "not_asked";

/** A question is answered once the answer received is saved. */
export function questionStatus(entry: QuestionEntry | undefined): QuestionStatus {
  return entry?.answer ? "answered" : "not_asked";
}
