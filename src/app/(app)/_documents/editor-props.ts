import "server-only";
import type { DocumentView } from "@/components/document/document-view";
import { letterhead } from "@/components/document/letterhead";
import { currencyOptions } from "@/config/currencies";
import { formatRate, listTaxRates } from "@/modules/catalog";
import { getOrganizationLogo } from "@/modules/files";
import type { OrgContext } from "@/modules/identity";
import { getInvoiceRegistration, registrationFooter } from "@/modules/invoices";
import { getBusinessProfile } from "@/modules/organizations";
import { customerFormCopy } from "../customers/_components/customer-copy";
import type { DocumentKind, TaxRateChoice } from "./editor-types";

/** The business as it heads its documents: logo, names, address, contact and tax ID. */
export async function documentBusiness(ctx: OrgContext): Promise<DocumentView["business"]> {
  const [profile, logo] = await Promise.all([getBusinessProfile(ctx), getOrganizationLogo(ctx)]);
  return letterhead(
    profile,
    ctx.market,
    logo ? { src: `/api/files/${logo.id}`, width: logo.width, height: logo.height } : null,
  );
}

/** Everything the editor needs besides the document itself. */
export async function editorContext(ctx: OrgContext, kind: DocumentKind, currency: string) {
  const [business, rates, profile, registered] = await Promise.all([
    documentBusiness(ctx),
    listTaxRates(ctx),
    getBusinessProfile(ctx),
    kind === "invoice" ? getInvoiceRegistration(ctx) : Promise.resolve(null),
  ]);
  // Invoice mode (1.12): new bills will be issued as registered invoices.
  const registration = registered?.active ? registered : null;
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
    title: registration?.title ?? ctx.market.documents[kind].singular,
    // Quotations and billing statements are supplementary documents (RR 7-2024
    // Sec. 6 B.15, D13); registered invoices print their registration instead (B.21).
    notice: registration ? null : ctx.market.supplementaryDocumentNotice,
    registration: registration
      ? registrationFooter({ ...registration, serial: registration.nextSerial }, ctx.market, ctx.locale)
      : null,
    // Invoices show how to pay; the instructions are snapshotted when sent.
    paymentInstructions: kind === "invoice" ? profile.paymentInstructions : null,
    defaultUnit: ctx.market.units.service,
    shareChannels: ctx.market.shareChannels,
    emailVerified: ctx.emailVerified,
    locale: ctx.locale,
  };
}
