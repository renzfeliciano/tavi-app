import type { Metadata, Route } from "next";
import {
  BuildingIcon,
  ClipboardCheckIcon,
  FileBadgeIcon,
  HashIcon,
  MessageCircleQuestionMarkIcon,
  PercentIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { documentWording, type MarketProfile } from "@/config/markets";
import { can } from "@/modules/authz";
import { listTaxRates } from "@/modules/catalog";
import { listMyDevices, requireOrgContext } from "@/modules/identity";
import { getInvoiceRegistration } from "@/modules/invoices";
import { getBusinessProfile, getBusinessRegistration, listTeam } from "@/modules/organizations";
import { SettingsList, type SettingsSection } from "../_components/settings-list";
import {
  businessProfileState,
  devicesState,
  invoiceModeState,
  type RowState,
  registrationState,
  taxRatesState,
  teamState,
} from "../_lib/row-states";

export const metadata: Metadata = { title: "Settings" };

/** The short status on each row, by href. A row with none (or one this role may not read) shows only its purpose. */
type States = Partial<Record<string, RowState>>;

// Descriptions use the business's market wording (its tax-ID name, its taxes, its document names).
function sectionsFor(market: MarketProfile, states: States): SettingsSection[] {
  const suggestedTax = market.suggestedTaxRates[0]?.name;
  const sections: SettingsSection[] = [
    {
      href: "/settings/business",
      title: "Business profile",
      description: `Logo, address, ${market.taxId.label}, payment instructions and document defaults.`,
      icon: BuildingIcon,
    },
    ...(market.registration
      ? [
          {
            href: "/settings/registration" as Route,
            title: "Registration",
            description: `${market.registration.authority} and business name registration, return dates and your certificates.`,
            icon: ClipboardCheckIcon,
          },
        ]
      : []),
    ...(market.registration
      ? [
          {
            href: "/settings/questions" as Route,
            title: market.registration.questionnaire.title,
            description: market.registration.questionnaire.rowSummary,
            icon: MessageCircleQuestionMarkIcon,
          },
        ]
      : []),
    {
      href: "/settings/tax-rates",
      title: "Tax rates",
      description: suggestedTax ? `${suggestedTax} and any other taxes you charge.` : "The taxes you charge.",
      icon: PercentIcon,
    },
    {
      href: "/settings/numbering",
      title: "Document numbers",
      description: `How your ${documentWording(market).quoteAndInvoice} numbers look.`,
      icon: HashIcon,
    },
    ...(market.invoiceRegistration
      ? [
          {
            href: "/settings/invoicing" as Route,
            title: "Invoice registration",
            description: `Turn your ${market.documents.invoice.plural.toLowerCase()} into registered invoices once your RDO has registered your system.`,
            icon: FileBadgeIcon,
          },
        ]
      : []),
    {
      href: "/settings/team",
      title: "Team",
      description: "Invite the people who work with you, and choose what each of them can do.",
      icon: UsersIcon,
    },
    {
      href: "/settings/security",
      title: "Security",
      description: "See the devices signed in to your account and sign them out.",
      icon: ShieldCheckIcon,
    },
    {
      href: "/recycle-bin",
      title: "Recycle bin",
      description: "Bring back a draft you deleted, or an archived customer, product, service or tax.",
      icon: Trash2Icon,
    },
    {
      href: "/settings/account",
      title: "Account and data",
      description: "Download a copy of your data, or close your account.",
      icon: UserRoundIcon,
    },
  ];
  return sections.map((section) => ({ ...section, state: states[section.href] }));
}

export default async function SettingsPage() {
  const ctx = await requireOrgContext();
  const { market } = ctx;
  // Each status reads only what this person's role may read; a failed read just leaves the row without one.
  const [profile, registration, rates, invoicing, team, devices] = await Promise.all([
    getBusinessProfile(ctx).catch(() => null),
    market.registration && can(ctx, "organization.manage") ? getBusinessRegistration(ctx).catch(() => null) : null,
    can(ctx, "catalog.read") ? listTaxRates(ctx).catch(() => null) : null,
    market.invoiceRegistration && can(ctx, "invoices.read") ? getInvoiceRegistration(ctx).catch(() => undefined) : undefined,
    listTeam(ctx).catch(() => null),
    listMyDevices().catch(() => null),
  ]);
  const states: States = {
    ...(profile && { "/settings/business": businessProfileState(profile, market.taxId.label) }),
    ...(registration && { "/settings/registration": registrationState(registration) }),
    ...(rates && { "/settings/tax-rates": taxRatesState(rates) }),
    ...(invoicing !== undefined && { "/settings/invoicing": invoiceModeState(invoicing) }),
    ...(team && { "/settings/team": teamState(team.members.length, team.invitations.length) }),
    ...(devices && { "/settings/security": devicesState(devices.length) }),
  };
  return (
    <>
      <PageHeader title="Settings" description="Your business details, document defaults and account." />
      <SettingsList sections={sectionsFor(market, states)} />
    </>
  );
}
