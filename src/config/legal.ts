// Who runs Tavi, and the versions of its Terms of Service and Privacy Notice
// (proposal §M 1.13b, risk N.1). This is about Tavi itself, the operator and
// personal information controller for account data, so it isn't part of a
// business's market profile (D12): the law that governs Tavi doesn't change
// with the country a business bills in.
//
// Fill in `operator` before the private beta (docs/runbooks/production-deploy.md).
// Until then the legal pages say they're a draft and show what's missing.

/** Shown in place of a detail that hasn't been filled in yet. */
export const LEGAL_PLACEHOLDER = "[to be added before launch]";

export type LegalOperator = {
  /** Registered name of the person or business that runs Tavi. */
  name: string | null;
  /** Registered address, on one line. */
  address: string | null;
  /** Where people send privacy requests; also the data protection officer's contact. */
  privacyEmail: string | null;
  /** The data protection officer's name or title (RA 10173 Sec. 21(b)). */
  dataProtectionOfficer: string | null;
};

const operator: LegalOperator = {
  name: null,
  address: null,
  privacyEmail: null,
  dataProtectionOfficer: null,
};

export const LEGAL = {
  operator,
  /**
   * One version for both documents, as the date they last changed materially
   * (YYYY-MM-DD). Sign-up records the version a person agreed to; bump it
   * when either document changes in a way people should agree to again.
   */
  version: "2026-10-08",
  jurisdiction: {
    country: "the Philippines",
    privacyLaw: "Data Privacy Act of 2012 (Republic Act No. 10173)",
    regulator: "National Privacy Commission",
    regulatorUrl: "https://privacy.gov.ph",
    /** Hours to notify the regulator of a personal data breach (NPC Circular 16-03 Sec. 17). */
    breachNotificationHours: 72,
  },
} as const;

/** Paths of the public legal pages, linked from sign-up and every footer. */
export const LEGAL_PATHS = { terms: "/terms", privacy: "/privacy" } as const;

const OPERATOR_LABELS: Record<keyof LegalOperator, string> = {
  name: "operator name",
  address: "registered address",
  privacyEmail: "privacy contact email",
  dataProtectionOfficer: "data protection officer",
};

/** The operator details still missing, in plain words (empty once complete). */
export function missingLegalDetails(operator: LegalOperator = LEGAL.operator): string[] {
  return (Object.keys(OPERATOR_LABELS) as (keyof LegalOperator)[])
    .filter((key) => !operator[key]?.trim())
    .map((key) => OPERATOR_LABELS[key]);
}

/** An operator detail for display, or the placeholder while it's missing. */
export function legalDetail(value: string | null): string {
  return value?.trim() || LEGAL_PLACEHOLDER;
}
