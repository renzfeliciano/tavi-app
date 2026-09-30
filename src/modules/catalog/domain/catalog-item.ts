import { z } from "zod";
import { examplePrice, isCurrencyCode, parseMoneyInput } from "@/shared/money";
import { optionalText, requiredCurrency, requiredText } from "@/shared/validation/fields";

// Products and services (§B.1, D8): two separate lists with the same shape,
// except that only products have a SKU. Prices are typed in the business's
// locale and stored as integer minor units of the item's own currency.

export const CATALOG_ITEM_KINDS = ["product", "service"] as const;
export type CatalogItemKind = (typeof CATALOG_ITEM_KINDS)[number];

export const CATALOG_ITEM_LIMITS = {
  name: 120,
  description: 1000,
  sku: 40,
  unitLabel: 20,
} as const;

/** Items per page in the catalog lists. */
export const CATALOG_PAGE_SIZE = 25;

const asText = (value: unknown) => (typeof value === "string" ? value : "");

type SchemaOptions = {
  kind: CatalogItemKind;
  /** The business's locale, for reading typed prices. */
  locale: string;
  /** The market's default units, for examples. */
  units: Record<CatalogItemKind, string>;
};

export function catalogItemSchemaFor({ kind, locale, units }: SchemaOptions) {
  const L = CATALOG_ITEM_LIMITS;
  const base = z.object({
    name: requiredText(L.name, "Enter a name."),
    description: optionalText(L.description),
    ...(kind === "product" ? { sku: optionalText(L.sku) } : {}),
    unitLabel: requiredText(L.unitLabel, `Enter a unit, e.g. ${units[kind]}.`),
    unitPrice: z.preprocess(asText, z.string()),
    currency: requiredCurrency(),
    taxRateId: z.preprocess(
      asText,
      z
        .string()
        .refine((v) => v === "" || z.uuid().safeParse(v).success, { error: "Choose a tax rate from the list." })
        .transform((v) => (v === "" ? null : v)),
    ),
  });

  // The price can only be read once the currency is known to be valid.
  return base.transform(({ unitPrice, ...item }, ctx) => {
    const unitPriceMinor = isCurrencyCode(item.currency)
      ? parseMoneyInput(unitPrice, item.currency, locale)
      : null;
    if (unitPriceMinor === null) {
      ctx.issues.push({
        code: "custom",
        path: ["unitPrice"],
        input: unitPrice,
        message: `Enter a price like ${examplePrice(item.currency, locale)}.`,
      });
      return z.NEVER;
    }
    return { ...item, unitPriceMinor };
  });
}

export type CatalogItemInput = z.infer<ReturnType<typeof catalogItemSchemaFor>> & { sku?: string | null };

/** The fields each form posts. */
export const CATALOG_ITEM_FIELDS = {
  product: ["name", "description", "sku", "unitLabel", "unitPrice", "currency", "taxRateId"],
  service: ["name", "description", "unitLabel", "unitPrice", "currency", "taxRateId"],
} as const satisfies Record<CatalogItemKind, readonly string[]>;

export { examplePrice } from "@/shared/money";
