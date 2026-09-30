import type { Metadata } from "next";
import { can } from "@/modules/authz";
import { formatRate, listTaxRates } from "@/modules/catalog";
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
        description="The taxes you charge. Tavi works out the tax on every line, so totals always add up."
      />
      {!editable && <ReadOnlyNotice />}
      <TaxRatesManager
        editable={editable}
        rates={rates.map((rate) => ({
          id: rate.id,
          name: rate.name,
          rate: formatRate(rate.rateBps),
          rateInput: formatRate(rate.rateBps).replace("%", ""),
          isDefault: rate.isDefault,
          archived: rate.archivedAt !== null,
        }))}
      />
    </>
  );
}
