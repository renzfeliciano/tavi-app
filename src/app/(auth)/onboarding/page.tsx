import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { currencyOptions } from "@/config/currencies";
import { DEFAULT_MARKET, MARKET_CODES, MARKETS } from "@/config/markets";
import { requireSession } from "@/modules/identity";
import { resolveMembership } from "@/modules/organizations";
import { BusinessForm } from "./business-form";

export const metadata: Metadata = { title: "Set up your business" };

// The only required setup (§G.5). Address, logo and tax details are asked for
// when they matter: the first time a quote is sent.
export default async function OnboardingPage() {
  const { user, session } = await requireSession();
  if (await resolveMembership(user.id, session.activeOrganizationId)) redirect("/dashboard");

  const firstName = user.name.split(" ")[0] || user.name;
  const defaultMarket = MARKETS[DEFAULT_MARKET];
  return (
    <>
      <AuthHeading
        title={`Welcome, ${firstName}`}
        description="One quick question before your first quote. You can add your address and logo later."
      />
      <BusinessForm
        currencies={currencyOptions({ locale: defaultMarket.locale, first: defaultMarket.currency })}
        countries={MARKET_CODES.map((code) => ({ code, name: MARKETS[code].countryName }))}
        defaultCountry={defaultMarket.country}
      />
    </>
  );
}
