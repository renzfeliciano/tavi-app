import "server-only";
import type { DocumentView } from "@/components/document/document-view";
import { currencyOptions } from "@/config/currencies";
import { formatAddressLines } from "@/config/markets";
import { formatRate, listTaxRates } from "@/modules/catalog";
import { getOrganizationLogo } from "@/modules/files";
import type { OrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import { customerFormCopy } from "../../customers/_components/customer-copy";
import type { TaxRateChoice } from "./editor-types";

/** The business as it heads its documents: logo, names, address, contact and tax ID. */
export async function documentBusiness(ctx: OrgContext): Promise<DocumentView["business"]> {
  const [profile, logo] = await Promise.all([getBusinessProfile(ctx), getOrganizationLogo(ctx)]);
  return {
    name: profile.name,
    subtitle: profile.legalName && profile.legalName !== profile.name ? profile.legalName : null,
    addressLines: formatAddressLines(profile, ctx.market),
    contactLines: [profile.email, profile.phone].filter((line): line is string => Boolean(line)),
    taxId: profile.taxId ? { label: ctx.market.taxId.label, value: profile.taxId } : null,
    logo: logo ? { src: `/api/files/${logo.id}`, width: logo.width, height: logo.height } : null,
  };
}

/** Everything the editor needs besides the quote itself. */
export async function editorContext(ctx: OrgContext, currency: string) {
  const [business, rates] = await Promise.all([documentBusiness(ctx), listTaxRates(ctx)]);
  const taxRates: TaxRateChoice[] = rates.map((rate) => ({
    id: rate.id,
    name: rate.name,
    rateBps: rate.rateBps,
    label: `${rate.name} (${formatRate(rate.rateBps, ctx.locale)})${rate.archivedAt ? " · archived" : ""}`,
    archived: rate.archivedAt !== null,
  }));
  return {
    business,
    taxRates,
    defaultTaxRateId: rates.find((r) => r.isDefault && r.archivedAt === null)?.id ?? null,
    currencies: currencyOptions({ locale: ctx.locale, first: currency }),
    customerCopy: customerFormCopy(ctx),
    title: ctx.market.documents.quote.singular,
    defaultUnit: ctx.market.units.service,
    locale: ctx.locale,
  };
}
