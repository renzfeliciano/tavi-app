// Everything that differs between countries lives here, never in screens or
// validation: currency, locale, time zone, tax suggestions, tax-ID format,
// address and document wording. Each business stores its country
// (`organizations.country_code`) and reads its profile with `marketFor`.
// Launching a new country means adding one entry below.

export type TaxMode = "inclusive" | "exclusive";

/** How a payment was made (stored); each market names them in its own words. */
export const PAYMENT_METHODS = ["bank_transfer", "ewallet", "cash", "card", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  };
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
  /**
   * Tax a customer may withhold from a payment and settle with the tax
   * authority (PH: creditable withholding tax, BIR Form 2307), or null.
   * It counts toward the balance, so the invoice closes.
   */
  taxWithheld: { label: string; hint: string } | null;
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
    kinds: readonly { code: string; label: string; idLabel: string; rateBps: number; taxExempt: boolean }[];
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
    },
    registeredNameHint: "If different, e.g. as on your DTI or SEC papers.",
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
      cash: "Cash",
      card: "Card",
      cheque: "Cheque",
      other: "Other",
    },
    taxWithheld: {
      label: "Tax withheld (BIR Form 2307)",
      hint: "If your customer withheld creditable tax, enter it here. It counts toward the balance; keep their Form 2307.",
    },
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
        label: "Non-VAT, exempt from VAT and percentage tax",
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
        { code: "senior_citizen", label: "Senior citizen", idLabel: "OSCA / SC ID No.", rateBps: 2000, taxExempt: true },
        // RA 10754 (PWD benefits), RR 5-2017: 20% and VAT-exempt.
        { code: "pwd", label: "Person with disability", idLabel: "PWD ID No.", rateBps: 2000, taxExempt: true },
        // RA 11861 (Expanded Solo Parents Welfare Act), RR 1-2023: 10% and VAT-exempt.
        { code: "solo_parent", label: "Solo parent", idLabel: "Solo Parent ID No.", rateBps: 1000, taxExempt: true },
        // RA 10699 (National Athletes and Coaches), RR 13-2020: 20%; VAT stays on the full price.
        { code: "naac", label: "National athlete or coach", idLabel: "PNSTM ID No.", rateBps: 2000, taxExempt: false },
        // RA 9049 (Medal of Valor awardees and dependents): 20%; no VAT exemption in the law.
        { code: "mov", label: "Medal of Valor awardee", idLabel: "MOV ID No.", rateBps: 2000, taxExempt: false },
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
    supplementaryDocumentNotice: "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.",
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
