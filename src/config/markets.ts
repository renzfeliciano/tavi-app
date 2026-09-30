// Everything that differs between countries lives here, never in screens or
// validation: currency, locale, time zone, tax suggestions, tax-ID format,
// address and document wording. Each business stores its country
// (`organizations.country_code`) and reads its profile with `marketFor`.
// Launching a new country means adding one entry below.

export type TaxMode = "inclusive" | "exclusive";

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
  /** Default unit names for new catalog items, in the market's language. */
  units: { product: string; service: string };
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
    units: { product: "pc", service: "hour" },
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
