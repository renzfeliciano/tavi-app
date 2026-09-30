import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { can } from "@/modules/authz";
import { formatRate, formatRateForInput, listTaxRates } from "@/modules/catalog";
import { requireOrgContext } from "@/modules/identity";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import { TaxRatesManager } from "./tax-rates-manager";

export const metadata: Metadata = { title: "Tax rates" };

export default async function TaxRatesPage() {
  const ctx = await requireOrgContext();
  const rates = await listTaxRates(ctx);
  const editable = can(ctx, "organization.manage");

  return (
    <>
      <SettingsPageHeader
        title="Tax rates"
        description={`The taxes you charge. ${brand.name} works out the tax on every line, so totals always add up.`}
      />
      {!editable && <ReadOnlyNotice />}
      <TaxRatesManager
        editable={editable}
        // Presets from the business's market (e.g. VAT in PH); none are created automatically.
        suggestions={ctx.market.suggestedTaxRates.map((rate) => ({
          name: rate.name,
          rate: formatRate(rate.rateBps, ctx.locale),
          rateInput: formatRateForInput(rate.rateBps, ctx.locale),
        }))}
        rates={rates.map((rate) => ({
          id: rate.id,
          name: rate.name,
          rate: formatRate(rate.rateBps, ctx.locale),
          rateInput: formatRateForInput(rate.rateBps, ctx.locale),
          isDefault: rate.isDefault,
          archived: rate.archivedAt !== null,
        }))}
      />
    </>
  );
}
