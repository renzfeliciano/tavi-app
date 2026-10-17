// Everything that differs between countries lives here, never in screens or
// validation: currency, locale, time zone, tax suggestions, tax-ID format,
// address and document wording. Each business stores its country
// (`organizations.country_code`) and reads its profile with `marketFor`.
// Launching a new country means adding one entry below.

export type TaxMode = "inclusive" | "exclusive";

/** How a payment was made (stored); each market names them in its own words. */
export const PAYMENT_METHODS = ["bank_transfer", "ewallet", "bank_deposit", "cash", "card", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The words for a payment's proof fields: one reference number, who it went through, and who paid. */
export type PaymentDetailLabels = { reference: string; institution: string | null; payer: string };

export type MarketProfile = {
  /** ISO 3166-1 alpha-2. */
  country: string;
  countryName: string;
  /** ISO 4217 code new businesses start with. */
  currency: string;
  /** BCP 47 tag for formatting dates, numbers and money. */
  locale: string;
  /** IANA time zone for due dates and "today". */
  timezone: string;
  /** How prices are usually quoted in this market. */
  defaultTaxMode: TaxMode;
  /** Offered as one-click presets; never created automatically (not every business is registered). */
  suggestedTaxRates: readonly { name: string; rateBps: number }[];
  taxId: {
    /** Short label, e.g. "TIN". */
    label: string;
    pattern: RegExp;
    example: string;
    /** Under the field, when the plain "Printed on your documents, e.g. {example}." isn't enough. */
    hint?: string;
  };
  /**
   * What an empty field shows ("e.g. 0917 123 4567"): believable values in this market's own formats, never a real
   * person or number. Written without the "e.g.", which the form adds.
   */
  examples: {
    person: string;
    company: string;
    business: string;
    email: string;
    phone: string;
    address: { line1: string; line2: string; city: string; region: string; postalCode: string };
  };
  /** Under "Business name": the name customers know the business by (PH: the trade name). */
  businessNameHint: string;
  registeredNameHint: string;
  address: {
    line2Label: string;
    cityLabel: string;
    regionLabel: string;
    postalCodeLabel: string;
    /** How the last address line is written, e.g. "{city}, {region} {postalCode}". */
    localityFormat: string;
  };
  /** How customers here usually pay, in running text. */
  paymentMethods: string;
  /** The name of each payment method, in this market's words. */
  paymentMethodLabels: Record<PaymentMethod, string>;
  /** What each proof-of-payment field is called for each method (null: the method has no such field). */
  paymentDetailLabels: Record<PaymentMethod, PaymentDetailLabels>;
  /** What each of those fields shows while empty (`institution` is null where the method has no such field). */
  paymentDetailExamples: Record<PaymentMethod, { reference: string; institution: string | null; payer: string }>;
  /** The date printed on a cheque (it can be post-dated). */
  chequeDateLabel: string;
  /**
   * Tax a customer may withhold from a payment and settle with the tax
   * authority (PH: creditable withholding tax, BIR Form 2307), or null.
   * It counts toward the balance, so the invoice closes.
   */
  taxWithheld: { label: string; hint: string; certificate: { name: string; short: string } } | null;
  /**
   * ATC codes (with their rate in basis points) offered as suggestions on a withholding certificate. A person can
   * always type another code and rate, so this is a starting list, not a rule. Empty where `taxWithheld` is null.
   */
  withholdingAtcs: readonly { code: string; rateBps: number }[];
  paymentInstructionsHint: string;
  paymentInstructionsPlaceholder: string;
  /** Where people paste a document link, in running text. */
  shareChannels: string;
  /** Document titles. PH uses non-BIR wording until the BIR confirms otherwise (D11). */
  documents: {
    quote: { singular: string; plural: string };
    invoice: { singular: string; plural: string };
    receipt: { singular: string; plural: string; disclaimer?: string };
  };
  /**
   * Tax registration statuses a business can have. `statement` precedes the
   * TIN on every document (PH: "VAT Reg TIN 123-456-789-00000", RR 7-2024
   * Sec. 6 B.2); only statuses with `suggestsTaxes` see the suggested rates.
   */
  taxRegistrations: readonly {
    code: string;
    label: string;
    statement: string;
    suggestsTaxes: boolean;
    /** How a registered invoice from this seller breaks down its sales (B.13–B.17). */
    invoiceSales: "vat" | "percentage_tax" | "exempt";
  }[];
  /** Where a business finds its tax registration status. */
  taxRegistrationHint: string;
  /**
   * Registering a business's invoicing system with the tax authority, or null
   * where TAVI bills are never registered invoices. PH: the RDO's
   * Acknowledgement Certificate / Permit to Use for a computerized system,
   * with its approved serial range (RR 7-2024 Sec. 6 B.21, D13). Once a
   * business enters it, its bills are titled invoices and numbered inside
   * the series (proposal §B.7, 1.12).
   */
  invoiceRegistration: {
    numberLabel: string;
    numberHint: string;
    dateLabel: string;
    seriesHint: string;
    /** Titles the business may print (A.3: the word "Invoice", prominent). */
    titles: readonly string[];
    /** Printed at the foot of each registered invoice: {number} {date} {start} {end}. */
    footer: string;
    /** Printed prominently at the top of every print after the first (PH: RR 7-2024 Sec. 6 B.21, D19). */
    reprint: string;
    /** How a registered invoice names its sales breakdown (PH: RR 7-2024 Sec. 6 B.13–B.17). */
    sales: {
      vatable: string;
      vat: string;
      zeroRated: string;
      exempt: string;
      percentageTax: string;
      /** Printed alone by sellers exempt from VAT and percentage tax (B.16). */
      exemptSeller: string;
      /** Shown in a line's tax column (B.14). */
      zeroRatedLine: string;
      exemptLine: string;
    };
    /**
     * When the buyer's tax ID must be on the invoice (PH: sales of ₱1,000 or
     * more to a VAT-registered buyer, RR 7-2024 Sec. 3 B.4). TAVI can't know
     * whether a buyer is VAT-registered, so it reminds rather than blocks.
     */
    buyerTaxId: { currency: string; thresholdMinor: number; reminder: string };
  } | null;
  /**
   * Discounts the law grants qualified buyers on a whole sale, or null where
   * there are none (D19). PH: senior citizens, PWDs, solo parents, national
   * athletes and coaches and Medal of Valor awardees, printed with the
   * buyer's ID number, the discount and VAT-exemption breakdown and a
   * signature line (RR 7-2024 Sec. 6 B.18). The discount is taken on the
   * price before tax; `taxExempt` sales also drop the tax.
   */
  qualifiedDiscounts: {
    kinds: readonly { code: string; label: string; idLabel: string; idExample: string; rateBps: number; taxExempt: boolean }[];
    /** Shown under the choice in the editor. */
    hint: string;
    /** Marks the kinds that also drop the tax, in the editor's list (PH: "VAT-exempt"). */
    taxExemptLabel: string;
    /** Shown when an item also has its own discount: the law gives one or the other. */
    notWithLineDiscounts: string;
    /** The printed breakdown (B.18.b); {label} is the kind and {rate} its rate. */
    rows: { totalSales: string; lessTax: string; netOfTax: string; lessDiscount: string; addTax: string; totalDue: string };
    /** Under the buyer's signature line (B.18.c). */
    signature: string;
  } | null;
  /**
   * The business's registration with the tax authority and the bodies that
   * register its name (PH: BIR Certificate of Registration, DTI/SEC/CDA),
   * the returns that follow from it, and the certificates worth keeping, or
   * null where TAVI doesn't track them.
   */
  registration: {
    /** "BIR": the tax authority, in running text. */
    authority: string;
    /** The document that proves the tax registration (PH: Certificate of Registration, Form 2303). */
    certificate: string;
    taxpayerTypes: readonly { code: string; label: string; individual: boolean }[];
    /** How an individual taxpayer pays income tax (PH: graduated rates or the 8% option). */
    incomeTaxOptions: readonly { code: string; label: string; hint: string }[];
    /** Which option means "no percentage tax" (PH: eight_percent). */
    noPercentageTaxOption: string;
    office: { label: string; hint: string; pattern: RegExp; example: string };
    /** TIN suffixes that mean the head office (PH: 00000, or 000 on older certificates). */
    headOfficeSuffixes: readonly string[];
    taxRegisteredOnLabel: string;
    lineOfBusinessHint: string;
    /** An example line of business for the empty field, without the "e.g." (PH: "Auto repair shop"). */
    lineOfBusinessExample: string;
    industryCode: { label: string; hint: string; pattern: RegExp; example: string };
    /** Who registers the business name (PH: DTI for sole proprietors, SEC for corporations and partnerships, CDA for cooperatives). */
    nameRegistration: {
      authorities: readonly { code: string; label: string; numberLabel: string; scoped: boolean; expires: boolean }[];
      scopes: readonly { code: string; label: string }[];
    };
    /** What a business keeps in its certificate folder. */
    documentKinds: readonly { code: string; label: string }[];
    /** The returns and renewals that follow from the registration (see domain/tax-deadlines). */
    filings: readonly {
      form: string;
      name: string;
      /** Everything listed must match. An empty list matches anyone. */
      registrations?: readonly string[];
      taxpayerTypes?: readonly string[];
      /** Skipped for businesses on one of these income tax options. */
      exceptIncomeTaxOptions?: readonly string[];
      /** Each due date, and the day its period ends (yearsBack 1: the period ended in the previous year). */
      occurrences: readonly {
        month: number;
        day: number;
        periodEnd: { month: number; day: number; yearsBack: 0 | 1 };
      }[];
    }[];
    deadlinesNote: string;
  } | null;
  /** Printed in bold on documents that aren't registered invoices (PH: RR 7-2024 Sec. 6 B.15), or null. */
  supplementaryDocumentNotice: string | null;
  /**
   * The units a line or a catalog item can be priced in, in the market's
   * language: a fixed list, so the same thing is always written the same way
   * ("hour", never "hr" on one quote and "hours" on the next). `product` and
   * `service` are the defaults for new items and must be in `options`.
   */
  units: { product: string; service: string; options: readonly string[] };
  /** New-business defaults, editable in Settings. */
  quoteValidityDays: number;
  paymentTermsDays: number;
};

/** What an empty field shows in this market (see `MarketProfile.examples`). */
export type MarketExamples = MarketProfile["examples"];
/** What each payment-proof field shows while empty, per method (see `MarketProfile.paymentDetailExamples`). */
export type PaymentDetailExamples = MarketProfile["paymentDetailExamples"];

const PH_SUPPLEMENTARY_NOTICE = "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.";

export const MARKETS = {
  PH: {
    country: "PH",
    countryName: "Philippines",
    currency: "PHP",
    locale: "en-PH",
    timezone: "Asia/Manila",
    defaultTaxMode: "inclusive",
    suggestedTaxRates: [{ name: "VAT", rateBps: 1200 }],
    taxId: {
      label: "TIN",
      pattern: /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/,
      example: "123-456-789-00000",
      hint: "Printed on your documents, e.g. 123-456-789-00000. End it with your branch code: 00000 for the head office.",
    },
    examples: {
      person: "Juan Dela Cruz",
      company: "Reyes Hardware Trading",
      business: "Dela Cruz Aircon Services",
      email: "juan@example.com",
      phone: "0917 123 4567",
      address: { line1: "123 Rizal Street", line2: "Unit 4B, Barangay San Roque", city: "Quezon City", region: "Metro Manila", postalCode: "1100" },
    },
    businessNameHint: "Your trade name, as customers know you and as on your DTI certificate.",
    registeredNameHint: "The taxpayer name on your BIR Certificate of Registration. For a sole proprietor, that's your own name.",
    address: {
      line2Label: "Building, unit or barangay",
      cityLabel: "City or municipality",
      regionLabel: "Province",
      postalCodeLabel: "ZIP code",
      localityFormat: "{city}, {region} {postalCode}",
    },
    paymentMethods: "bank transfer, GCash, Maya, cash or card",
    paymentMethodLabels: {
      bank_transfer: "Bank transfer",
      ewallet: "GCash or Maya",
      bank_deposit: "Bank deposit (slip)",
      cash: "Cash",
      card: "Card",
      cheque: "Cheque",
      other: "Other",
    },
    paymentDetailLabels: {
      bank_transfer: { reference: "Reference no.", institution: "Bank", payer: "Sender (name or account)" },
      ewallet: { reference: "Reference no.", institution: "Wallet (GCash, Maya…)", payer: "Sender (name or number)" },
      bank_deposit: { reference: "Deposit slip no.", institution: "Bank", payer: "Depositor" },
      cash: { reference: "Receipt no.", institution: null, payer: "Paid by" },
      card: { reference: "Approval or reference no.", institution: "Card issuer or bank", payer: "Cardholder" },
      cheque: { reference: "Cheque no.", institution: "Bank on the cheque", payer: "Name on the cheque" },
      other: { reference: "Reference no.", institution: "Bank or wallet", payer: "Paid by" },
    },
    paymentDetailExamples: {
      bank_transfer: { reference: "4012 8830 1127", institution: "BDO", payer: "Juan Dela Cruz" },
      ewallet: { reference: "1234 567 890123", institution: "GCash", payer: "0917 123 4567" },
      bank_deposit: { reference: "0045812", institution: "BPI", payer: "Juan Dela Cruz" },
      cash: { reference: "1042", institution: null, payer: "Juan Dela Cruz" },
      card: { reference: "A12345", institution: "BDO Visa", payer: "Juan Dela Cruz" },
      cheque: { reference: "0012345", institution: "Metrobank", payer: "Juan Dela Cruz" },
      other: { reference: "12345", institution: "Maya", payer: "Juan Dela Cruz" },
    },
    chequeDateLabel: "Date on the cheque",
    taxWithheld: {
      label: "Tax withheld (BIR Form 2307)",
      hint: "If your customer withheld creditable tax, enter it here. It counts toward the balance; keep their Form 2307.",
      // What the customer sends later, in full and in the short form badges and links use ("2307 pending").
      certificate: { name: "BIR Form 2307", short: "2307" },
    },
    // The one ATC on the sample certificate. More are added once the CPA confirms them (compliance questionnaire, CPA question 8).
    withholdingAtcs: [{ code: "WI160", rateBps: 200 }],
    paymentInstructionsHint: "Bank account, GCash or Maya number.",
    paymentInstructionsPlaceholder: "e.g. GCash 0917 123 4567 (Juan Dela Cruz)",
    shareChannels: "Messenger or Viber",
    documents: {
      quote: { singular: "Quotation", plural: "Quotations" },
      invoice: { singular: "Billing statement", plural: "Billing statements" },
      receipt: {
        singular: "Payment acknowledgement",
        plural: "Payment acknowledgements",
        disclaimer: "Not a BIR official receipt.",
      },
    },
    taxRegistrations: [
      { code: "vat", label: "VAT-registered", statement: "VAT Reg TIN", suggestsTaxes: true, invoiceSales: "vat" },
      {
        code: "non_vat",
        label: "Non-VAT, subject to percentage tax",
        statement: "Non-VAT Reg TIN",
        suggestsTaxes: false,
        invoiceSales: "percentage_tax",
      },
      {
        code: "non_vat_exempt",
        label: "Non-VAT, no percentage tax (8% option or exempt)",
        statement: "Non-VAT Reg TIN",
        suggestsTaxes: false,
        invoiceSales: "exempt",
      },
    ],
    taxRegistrationHint: "As on your BIR Certificate of Registration. Printed before your TIN.",
    invoiceRegistration: {
      numberLabel: "Acknowledgement Certificate or PTU number",
      numberHint: "Issued by your RDO when it registered your computerized invoicing system.",
      dateLabel: "Date issued",
      seriesHint: "The serial numbers your RDO approved for your invoices.",
      titles: ["Invoice", "Service Invoice", "Sales Invoice", "Billing Invoice", "Commercial Invoice"],
      footer: "Acknowledgement Certificate / PTU No. {number} · Date issued {date} · Approved series {start} to {end}",
      reprint: "REPRINT",
      sales: {
        vatable: "VATable Sales",
        vat: "VAT Amount",
        zeroRated: "Zero-Rated Sales",
        exempt: "VAT-Exempt Sales",
        percentageTax: "Sales Subject to Percentage Tax",
        exemptSeller: "EXEMPT",
        zeroRatedLine: "Zero-rated sale",
        exemptLine: "VAT-exempt sale",
      },
      buyerTaxId: {
        currency: "PHP",
        thresholdMinor: 100_000,
        reminder: "If this customer is VAT-registered, add their TIN to their details first: the BIR requires it on invoices of ₱1,000 or more.",
      },
    },
    qualifiedDiscounts: {
      // Rates and VAT treatment from the laws and their revenue regulations,
      // as read by the founder (D19). Not legal advice.
      kinds: [
        // RA 9994 (Expanded Senior Citizens Act), RR 7-2010: 20% and VAT-exempt.
        { code: "senior_citizen", label: "Senior citizen", idLabel: "OSCA / SC ID No.", idExample: "123456", rateBps: 2000, taxExempt: true },
        // RA 10754 (PWD benefits), RR 5-2017: 20% and VAT-exempt.
        { code: "pwd", label: "Person with disability", idLabel: "PWD ID No.", idExample: "123456", rateBps: 2000, taxExempt: true },
        // RA 11861 (Expanded Solo Parents Welfare Act), RR 1-2023: 10% and VAT-exempt.
        { code: "solo_parent", label: "Solo parent", idLabel: "Solo Parent ID No.", idExample: "123456", rateBps: 1000, taxExempt: true },
        // RA 10699 (National Athletes and Coaches), RR 13-2020: 20%; VAT stays on the full price.
        { code: "naac", label: "National athlete or coach", idLabel: "PNSTM ID No.", idExample: "123456", rateBps: 2000, taxExempt: false },
        // RA 9049 (Medal of Valor awardees and dependents): 20%; no VAT exemption in the law.
        { code: "mov", label: "Medal of Valor awardee", idLabel: "MOV ID No.", idExample: "123456", rateBps: 2000, taxExempt: false },
      ],
      hint: "For a buyer the law entitles to a discount. It applies to every item, on the price before VAT; senior citizens, PWDs and solo parents also don't pay VAT. Only for goods and services the law covers.",
      taxExemptLabel: "VAT-exempt",
      notWithLineDiscounts: "The law gives the higher of the two discounts, not both. Remove the item discounts, or choose no special discount.",
      rows: {
        totalSales: "Total Sales (VAT Inclusive)",
        lessTax: "Less: VAT",
        netOfTax: "Amount Net of VAT",
        lessDiscount: "Less: {label} discount ({rate})",
        addTax: "Add: VAT",
        totalDue: "Total Amount Due",
      },
      signature: "Signature over printed name",
    },
    registration: {
      authority: "BIR",
      certificate: "BIR Certificate of Registration (Form 2303)",
      taxpayerTypes: [
        { code: "sole_proprietor", label: "Single proprietorship", individual: true },
        { code: "professional", label: "Self-employed professional", individual: true },
        { code: "partnership", label: "Partnership", individual: false },
        { code: "corporation", label: "Corporation", individual: false },
        { code: "cooperative", label: "Cooperative", individual: false },
        { code: "other", label: "Other", individual: false },
      ],
      incomeTaxOptions: [
        { code: "graduated", label: "Graduated income tax rates", hint: "Quarterly and annual income tax on net income, plus percentage tax if you're non-VAT." },
        { code: "eight_percent", label: "8% on gross sales", hint: "For individuals earning up to ₱3,000,000 a year. It replaces income tax and percentage tax. Your COR says \"Availed of 8%: Yes\"." },
      ],
      noPercentageTaxOption: "eight_percent",
      office: {
        label: "RDO code",
        hint: "Your Revenue District Office, on your COR (e.g. 044 for Taguig-Pateros).",
        pattern: /^\d{3}$/,
        example: "044",
      },
      headOfficeSuffixes: ["00000", "000"],
      taxRegisteredOnLabel: "Registered with the BIR on",
      lineOfBusinessHint: "As on your COR, e.g. Auto repair shop.",
      lineOfBusinessExample: "Auto repair shop",
      industryCode: {
        label: "PSIC code",
        hint: "The industry code on your COR, e.g. 45209.",
        pattern: /^\d{4,5}$/,
        example: "45209",
      },
      nameRegistration: {
        authorities: [
          { code: "dti", label: "DTI (single proprietorship)", numberLabel: "Business Name No.", scoped: true, expires: true },
          { code: "sec", label: "SEC (corporation or partnership)", numberLabel: "SEC registration no.", scoped: false, expires: false },
          { code: "cda", label: "CDA (cooperative)", numberLabel: "CDA registration no.", scoped: false, expires: false },
        ],
        scopes: [
          { code: "barangay", label: "Barangay" },
          { code: "city", label: "City or municipality" },
          { code: "regional", label: "Regional" },
          { code: "national", label: "National" },
        ],
      },
      documentKinds: [
        { code: "cor", label: "BIR Certificate of Registration (2303)" },
        { code: "name_registration", label: "DTI, SEC or CDA certificate" },
        { code: "permit", label: "Mayor's or business permit" },
        { code: "other", label: "Other" },
      ],
      filings: [
        {
          form: "2550Q",
          name: "Quarterly VAT return",
          registrations: ["vat"],
          occurrences: [
          { month: 1, day: 25, periodEnd: { month: 12, day: 31, yearsBack: 1 } },
          { month: 4, day: 25, periodEnd: { month: 3, day: 31, yearsBack: 0 } },
          { month: 7, day: 25, periodEnd: { month: 6, day: 30, yearsBack: 0 } },
          { month: 10, day: 25, periodEnd: { month: 9, day: 30, yearsBack: 0 } }
          ],
        },
        {
          form: "2551Q",
          name: "Quarterly percentage tax return",
          registrations: ["non_vat"],
          exceptIncomeTaxOptions: ["eight_percent"],
          occurrences: [
          { month: 1, day: 25, periodEnd: { month: 12, day: 31, yearsBack: 1 } },
          { month: 4, day: 25, periodEnd: { month: 3, day: 31, yearsBack: 0 } },
          { month: 7, day: 25, periodEnd: { month: 6, day: 30, yearsBack: 0 } },
          { month: 10, day: 25, periodEnd: { month: 9, day: 30, yearsBack: 0 } }
          ],
        },
        {
          form: "1701Q",
          name: "Quarterly income tax return",
          taxpayerTypes: ["sole_proprietor", "professional"],
          occurrences: [
            { month: 5, day: 15, periodEnd: { month: 3, day: 31, yearsBack: 0 } },
            { month: 8, day: 15, periodEnd: { month: 6, day: 30, yearsBack: 0 } },
            { month: 11, day: 15, periodEnd: { month: 9, day: 30, yearsBack: 0 } },
          ],
        },
        {
          form: "1701 / 1701A",
          name: "Annual income tax return",
          taxpayerTypes: ["sole_proprietor", "professional"],
          occurrences: [{ month: 4, day: 15, periodEnd: { month: 12, day: 31, yearsBack: 1 } }],
        },
      ],
      deadlinesNote:
        "These follow the usual BIR calendar for your registration. A date that falls on a weekend or holiday usually moves to the next working day. Your Certificate of Registration lists the returns you must file; check it and your RDO.",
    },
    supplementaryDocumentNotice: PH_SUPPLEMENTARY_NOTICE,
    units: {
      product: "pc",
      service: "hour",
      options: [
        "hour", "day", "week", "month", "job", "visit", "session", "trip", "pax",
        "pc", "unit", "set", "lot", "box", "pack", "kg", "m", "sq m", "L",
      ],
    },
    quoteValidityDays: 30,
    paymentTermsDays: 15,
  },
} as const satisfies Record<string, MarketProfile>;

export type MarketCode = keyof typeof MARKETS;

/** Where new businesses start (Philippines first, D2). */
export const DEFAULT_MARKET: MarketCode = "PH";

export const MARKET_CODES = Object.keys(MARKETS) as MarketCode[];

export function isMarketCode(value: unknown): value is MarketCode {
  return typeof value === "string" && Object.hasOwn(MARKETS, value);
}

/** The profile for a stored country code; unknown codes fall back to the default market. */
export function marketFor(country: string | null | undefined): MarketProfile {
  return isMarketCode(country) ? MARKETS[country] : MARKETS[DEFAULT_MARKET];
}

/** Document names for running text, e.g. "quotations and billing statements". */
export function documentWording(market: MarketProfile) {
  const { quote, invoice } = market.documents;
  return {
    quotesAndInvoices: `${quote.plural.toLowerCase()} and ${invoice.plural.toLowerCase()}`,
    quoteAndInvoice: `${quote.singular.toLowerCase()} and ${invoice.singular.toLowerCase()}`,
    invoices: invoice.plural.toLowerCase(),
  };
}

export type AddressParts = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
};

/**
 * An address as printed lines, in the market's format. Missing parts are left
 * out without stray commas: "Pasig, Metro Manila 1600", "Pasig 1600".
 */
export function formatAddressLines(address: AddressParts, market: Pick<MarketProfile, "address">): string[] {
  // Walk the template: each placeholder keeps the separator written before it,
  // but only when a part was already printed and this one is present.
  let locality = "";
  const placeholder = /\{(city|region|postalCode)\}/g;
  let cursor = 0;
  for (const match of market.address.localityFormat.matchAll(placeholder)) {
    const separator = market.address.localityFormat.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const value = address[match[1] as "city" | "region" | "postalCode"]?.trim();
    if (!value) continue;
    locality += (locality ? separator : "") + value;
  }
  return [address.addressLine1?.trim(), address.addressLine2?.trim(), locality].filter(
    (line): line is string => Boolean(line),
  );
}

/** The document statement before a TIN ("VAT Reg TIN"), or the plain tax-ID label when the status isn't set. */
export function taxIdStatement(market: Pick<MarketProfile, "taxId" | "taxRegistrations">, registration: string | null): string {
  return market.taxRegistrations.find((r) => r.code === registration)?.statement ?? market.taxId.label;
}
