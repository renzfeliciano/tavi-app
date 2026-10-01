import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { formatSerial, getInvoiceRegistration } from "@/modules/invoices";
import { ReadOnlyNotice, SettingsPageHeader } from "../_components/settings-page-header";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = { title: "Invoice registration" };

// Invoice mode (D13, D14, proposal §B.7): a business that registered its
// invoicing system with the tax authority enters it here; its bills then
// become registered invoices. Markets without registration don't have the page.
export default async function InvoiceRegistrationPage() {
  const ctx = await requireOrgContext();
  const config = ctx.market.invoiceRegistration;
  if (!config) notFound();
  const registration = await getInvoiceRegistration(ctx);
  const editable = can(ctx, "organization.manage");
  const { singular } = ctx.market.documents.invoice;
  const on = registration?.active ?? false;
  const nextSerial = registration
    ? registration.nextSerial > registration.seriesEnd
      ? null
      : formatSerial(registration.nextSerial, registration.seriesEnd)
    : null;

  return (
    <>
      <SettingsPageHeader
        title="Invoice registration"
        description={`Until you enter a registration, your bills are ${singular.toLowerCase()}s, which aren't invoices for tax. Enter it once your RDO has registered your invoicing system.`}
      />
      {!editable && <ReadOnlyNotice />}
      <div className="mt-8 grid max-w-3xl gap-4">
        <section aria-labelledby="mode-heading" className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs sm:px-6">
          <h2 id="mode-heading" className="font-semibold">
            {on ? `On: new bills are issued as “${registration?.title}”` : `Off: new bills are ${singular.toLowerCase()}s`}
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {on
              ? `Numbered inside your approved series${nextSerial ? ` (next serial ${nextSerial})` : ", which is used up"}. Once sent, a registered invoice can't be edited: use void & duplicate to correct it.`
              : "Bills already sent stay as they are. Quotations and payment acknowledgements never change."}
          </p>
        </section>
        <RegistrationForm
          editable={editable}
          active={on}
          labels={{ number: config.numberLabel, numberHint: config.numberHint, date: config.dateLabel, seriesHint: config.seriesHint }}
          titles={config.titles}
          statementName={ctx.market.documents.invoice.plural.toLowerCase()}
          initial={
            registration
              ? {
                  number: registration.number,
                  issuedOn: registration.issuedOn,
                  seriesStart: String(registration.seriesStart),
                  seriesEnd: String(registration.seriesEnd),
                  title: registration.title,
                }
              : { number: "", issuedOn: "", seriesStart: "", seriesEnd: "", title: config.titles[0] ?? "" }
          }
        />
      </div>
    </>
  );
}
