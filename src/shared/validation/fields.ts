import { z } from "zod";
import { isCurrencyCode } from "@/shared/money";
import { tooLong } from "./messages";

// Form-field schemas shared by every module. Forms post strings (or nothing),
// so each field starts from "" and blank optional values become null.

const asText = (value: unknown) => (typeof value === "string" ? value : "");
const blankToNull = (v: string) => (v === "" ? null : v);

/** Required, trimmed, at most `max` characters. */
export const requiredText = (max: number, missing: string) =>
  z.preprocess(asText, z.string().trim().min(1, { error: missing }).max(max, { error: tooLong(max) }));

/** Optional, trimmed; blank becomes null. */
export const optionalText = (max: number) =>
  z.preprocess(asText, z.string().trim().max(max, { error: tooLong(max) }).transform(blankToNull));

/** Optional email, lower-cased; blank becomes null. */
export const optionalEmail = (max: number) =>
  z.preprocess(
    asText,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(max, { error: tooLong(max) })
      .refine((v) => v === "" || z.email().safeParse(v).success, { error: "Enter a valid email address." })
      .transform(blankToNull),
  );

/** Optional ISO 4217 code; blank (use the business's currency) becomes null. */
export const optionalCurrency = () =>
  z.preprocess(
    asText,
    z
      .string()
      .trim()
      .refine((v) => v === "" || isCurrencyCode(v), { error: "Choose a currency." })
      .transform(blankToNull),
  );

/** Required ISO 4217 code. */
export const requiredCurrency = () =>
  z.preprocess(asText, z.string().refine(isCurrencyCode, { error: "Choose a currency." }));
