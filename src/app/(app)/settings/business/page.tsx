import type { Metadata } from "next";
import { currencyOptions } from "@/config/currencies";
import { documentWording } from "@/config/markets";
import { can } from "@/modules/authz";
import { taxModeExamples } from "@/modules/catalog";
import { getOrganizationLogo } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";
import { type BusinessProfile, getBusinessProfile } from "@/modules/organizations";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import type { ProfileFormValues } from "./actions";
import { BusinessProfileForm, type BusinessProfileCopy } from "./business-profile-form";
import { LogoUploader } from "./logo-uploader";

export const metadata: Metadata = { title: "Business profile" };

function toFormValues(profile: BusinessProfile): ProfileFormValues {
  return Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, value === null ? "" : String(value)]),
  ) as ProfileFormValues;
}

export default async function BusinessProfilePage() {
  const ctx = await requireOrgContext();
  const [profile, logo] = await Promise.all([getBusinessProfile(ctx), getOrganizationLogo(ctx)]);
  const editable = can(ctx, "organization.manage");
  const { market } = ctx;
  const docs = documentWording(market);

  // Everything country-specific comes from the business's market profile.
  const copy: BusinessProfileCopy = {
    taxIdLabel: market.taxId.label,
    taxIdHint: `Printed on your documents, e.g. ${market.taxId.example}.`,
    taxRegistrations: market.taxRegistrations.map(({ code, label }) => ({ code, label })),
    taxRegistrationHint: market.taxRegistrationHint,
    registeredNameHint: market.registeredNameHint,
    address: market.address,
    documentsTitle: `${market.documents.quote.plural} and ${docs.invoices}`,
    documentsPhrase: docs.quoteAndInvoice,
    paymentInstructionsHint: `${market.paymentInstructionsHint} Shown on ${docs.invoices}.`,
    paymentInstructionsPlaceholder: market.paymentInstructionsPlaceholder,
    taxModes: taxModeExamples({
      currency: profile.currency,
      locale: ctx.locale,
      tax: market.suggestedTaxRates[0] ?? null,
    }),
    currencies: currencyOptions({ locale: ctx.locale, first: profile.currency }),
  };

  return (
    <>
      <SettingsPageHeader
        title="Business profile"
        description={`What your customers see on ${docs.quotesAndInvoices}, and where new ones start from.`}
      />
      {!editable && <ReadOnlyNotice />}
      <div className="mt-8 grid max-w-3xl gap-8">
        <LogoUploader
          logo={logo && { src: `/api/files/${logo.id}`, width: logo.width, height: logo.height }}
          businessName={profile.name}
          description={`Printed at the top of your ${docs.quotesAndInvoices}.`}
          editable={editable}
        />
        <BusinessProfileForm initialValues={toFormValues(profile)} copy={copy} editable={editable} />
      </div>
    </>
  );
}
