import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { can } from "@/modules/authz";
import { formatRate, formatRateForInput, listTaxRates } from "@/modules/catalog";
import { requireOrgContext } from "@/modules/identity";
import { getBusinessProfile } from "@/modules/organizations";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import { TaxRatesManager } from "./tax-rates-manager";

export const metadata: Metadata = { title: "Tax rates" };

export default async function TaxRatesPage() {
  const ctx = await requireOrgContext();
  const [rates, profile] = await Promise.all([listTaxRates(ctx), getBusinessProfile(ctx)]);
  const editable = can(ctx, "organization.manage");

  // Presets from the business's market (e.g. VAT in PH), offered only when its
  // tax registration charges them, or before it's set; none are created automatically.
  const registration = ctx.market.taxRegistrations.find((r) => r.code === profile.taxRegistration);
  const suggestions = !registration || registration.suggestsTaxes ? ctx.market.suggestedTaxRates : [];

  return (
    <>
      <SettingsPageHeader
        title="Tax rates"
        description={`The taxes you charge. ${brand.name} works out the tax on every line, so totals always add up.`}
      />
      {!editable && <ReadOnlyNotice />}
      {registration && !registration.suggestsTaxes && (
        <p className="mt-6 max-w-3xl rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty text-ink-subtle">
          You&apos;re set up as <strong className="font-medium">{registration.label}</strong> (Business profile), so
          your documents don&apos;t add {ctx.market.suggestedTaxRates[0]?.name ?? "tax"}. Add a tax here only if
          you&apos;re required to charge one.
        </p>
      )}
      <TaxRatesManager
        editable={editable}
        suggestions={suggestions.map((rate) => ({
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
