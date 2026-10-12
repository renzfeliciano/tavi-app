import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { tooLong } from "@/shared/validation/messages";
import { REGISTRATION_LIMITS as LIMITS } from "./limits";

// How the business is registered: with the tax authority (taxpayer type,
// income tax option, tax office, line of business) and with the body that
// registered its name (PH: DTI, SEC or CDA). It never changes a document or a
// tax calculation; it feeds the filing calendar and keeps the details a
// business is asked for at its tax office in one place. Market wording and
// rules come from `market.registration`.

/** The registration form's fields. Blank means "not set". */
export const REGISTRATION_FIELDS = [
  "taxpayerType",
  "incomeTaxOption",
  "taxOfficeCode",
  "taxRegisteredOn",
  "lineOfBusiness",
  "industryCode",
  "nameRegistrationAuthority",
  "nameRegistrationNumber",
  "nameRegistrationScope",
  "nameRegistrationValidFrom",
  "nameRegistrationValidUntil",
] as const;
export type RegistrationField = (typeof REGISTRATION_FIELDS)[number];

/** What is stored: each field is its value or null. */
export type RegistrationDetails = Record<RegistrationField, string | null>;

export type RegistrationResult =
  | { ok: true; details: RegistrationDetails }
  | { ok: false; errors: Partial<Record<RegistrationField, string>> };

type RegistrationConfig = NonNullable<MarketProfile["registration"]>;

export const EMPTY_REGISTRATION: RegistrationDetails = Object.fromEntries(
  REGISTRATION_FIELDS.map((field) => [field, null]),
) as RegistrationDetails;

const raw = z.record(z.string(), z.unknown());
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Validates the form. `taxRegistration` is how the business is registered for
 * tax (it lives in the business profile): the 8% option excludes both VAT and
 * percentage tax, so it can't sit beside either. `today` is the business's
 * own date.
 */
export function parseRegistration(
  config: RegistrationConfig,
  input: unknown,
  { taxRegistration, today }: { taxRegistration: string | null; today: CalendarDate },
): RegistrationResult {
  const shape = raw.safeParse(input);
  const source = shape.success ? shape.data : {};
  const errors: Partial<Record<RegistrationField, string>> = {};
  const v = (field: RegistrationField) => text(source[field]);
  const optional = (field: RegistrationField, max: number): string | null => {
    const value = v(field);
    if (value.length > max) errors[field] = tooLong(max);
    return value === "" ? null : value;
  };
  const oneOf = (field: RegistrationField, codes: readonly string[], message: string): string | null => {
    const value = v(field);
    if (value === "") return null;
    if (!codes.includes(value)) errors[field] = message;
    return value;
  };
  const date = (field: RegistrationField): CalendarDate | null => {
    const value = v(field);
    if (value === "") return null;
    if (!isCalendarDate(value)) {
      errors[field] = "Enter a real date.";
      return null;
    }
    return value;
  };

  const taxpayerType = oneOf("taxpayerType", config.taxpayerTypes.map((t) => t.code), "Choose a taxpayer type from the list.");
  const individual = config.taxpayerTypes.find((t) => t.code === taxpayerType)?.individual ?? false;

  const incomeTaxOption = oneOf("incomeTaxOption", config.incomeTaxOptions.map((o) => o.code), "Choose an option from the list.");
  if (incomeTaxOption && !errors.incomeTaxOption) {
    if (!individual) {
      errors.incomeTaxOption = taxpayerType
        ? "Only individuals choose between graduated rates and the 8% option."
        : "Choose your taxpayer type first.";
    } else if (incomeTaxOption === config.noPercentageTaxOption && (taxRegistration === "vat" || taxRegistration === "non_vat")) {
      errors.incomeTaxOption =
        taxRegistration === "vat"
          ? "The 8% option isn't open to VAT-registered businesses."
          : "On the 8% option you don't pay percentage tax. Change your tax registration in your business profile to “no percentage tax” first.";
    }
  }

  const taxOfficeCode = v("taxOfficeCode");
  if (taxOfficeCode !== "" && !config.office.pattern.test(taxOfficeCode)) {
    errors.taxOfficeCode = `Enter your ${config.office.label} like ${config.office.example}.`;
  }

  const taxRegisteredOn = date("taxRegisteredOn");
  if (taxRegisteredOn && compareDates(taxRegisteredOn, today) > 0) errors.taxRegisteredOn = "That date is in the future.";

  const lineOfBusiness = optional("lineOfBusiness", LIMITS.lineOfBusiness);
  const industryCode = v("industryCode");
  if (industryCode !== "" && !config.industryCode.pattern.test(industryCode)) {
    errors.industryCode = `Enter your ${config.industryCode.label} like ${config.industryCode.example}.`;
  }

  const authorities = config.nameRegistration.authorities;
  const authority = oneOf("nameRegistrationAuthority", authorities.map((a) => a.code), "Choose who registered your business name.");
  const authorityConfig = authorities.find((a) => a.code === authority);
  const nameNumber = optional("nameRegistrationNumber", LIMITS.registrationNumber);
  const scope = oneOf("nameRegistrationScope", config.nameRegistration.scopes.map((s) => s.code), "Choose a scope from the list.");
  const validFrom = date("nameRegistrationValidFrom");
  const validUntil = date("nameRegistrationValidUntil");

  if (!authority) {
    if (nameNumber || scope || validFrom || validUntil) {
      errors.nameRegistrationAuthority = "Choose who registered your business name.";
    }
  } else {
    if (!nameNumber && !errors.nameRegistrationNumber) {
      errors.nameRegistrationNumber = `Enter the ${authorityConfig?.numberLabel ?? "registration number"}.`;
    }
    if (authorityConfig && !authorityConfig.scoped && scope) errors.nameRegistrationScope = "Scope only applies to a DTI registration.";
    if (authorityConfig && !authorityConfig.expires && (validFrom || validUntil)) {
      errors.nameRegistrationValidUntil = "This registration doesn't expire.";
    }
  }
  if (validFrom && validUntil && compareDates(validUntil, validFrom) < 0) {
    errors.nameRegistrationValidUntil = "The end date can't be before the start date.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    details: {
      taxpayerType,
      incomeTaxOption: individual ? incomeTaxOption : null,
      taxOfficeCode: taxOfficeCode === "" ? null : taxOfficeCode,
      taxRegisteredOn,
      lineOfBusiness,
      industryCode: industryCode === "" ? null : industryCode,
      nameRegistrationAuthority: authority,
      nameRegistrationNumber: authority ? nameNumber : null,
      nameRegistrationScope: authorityConfig?.scoped ? scope : null,
      nameRegistrationValidFrom: authorityConfig?.expires ? validFrom : null,
      nameRegistrationValidUntil: authorityConfig?.expires ? validUntil : null,
    },
  };
}

/** The conflict between a business's income tax option and its tax registration, or null (see parseRegistration). */
export function incomeTaxConflict(
  config: Pick<RegistrationConfig, "noPercentageTaxOption">,
  incomeTaxOption: string | null,
  taxRegistration: string | null,
): string | null {
  if (incomeTaxOption !== config.noPercentageTaxOption) return null;
  if (taxRegistration === "vat") return "The 8% option isn't open to VAT-registered businesses. Change your income tax option first.";
  if (taxRegistration === "non_vat") {
    return "You're on the 8% option, so you don't pay percentage tax. Choose “no percentage tax” here, or change your income tax option first.";
  }
  return null;
}

/**
 * A TIN's parts: the nine-digit base and the branch code after it. A TIN
 * without a branch code has `branch: null`; the business can't be told apart
 * as head office or branch.
 */
export function tinParts(taxId: string | null): { base: string; branch: string | null } | null {
  if (!taxId) return null;
  const digits = taxId.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const branch = digits.slice(9);
  return { base: digits.slice(0, 9), branch: branch === "" ? null : branch };
}

export type RegisteringOffice = { kind: "head_office" } | { kind: "branch"; code: string } | { kind: "unknown" };

/** Whether the TIN's branch code marks the head office (PH: 00000) or a branch. */
export function registeringOffice(
  taxId: string | null,
  config: Pick<RegistrationConfig, "headOfficeSuffixes">,
): RegisteringOffice {
  const parts = tinParts(taxId);
  if (!parts || parts.branch === null) return { kind: "unknown" };
  return config.headOfficeSuffixes.includes(parts.branch) ? { kind: "head_office" } : { kind: "branch", code: parts.branch };
}
