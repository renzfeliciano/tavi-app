import type { Metadata, Route } from "next";
import Link from "next/link";
import { BuildingIcon, ChevronRightIcon, FileBadgeIcon, HashIcon, type LucideIcon, PercentIcon, ShieldCheckIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { documentWording, type MarketProfile } from "@/config/markets";
import { requireOrgContext } from "@/modules/identity";

export const metadata: Metadata = { title: "Settings" };

type Section = { href: Route; title: string; description: string; icon: LucideIcon };

// Descriptions use the business's market wording (its tax-ID name, its taxes, its document names).
function sectionsFor(market: MarketProfile): Section[] {
  const suggestedTax = market.suggestedTaxRates[0]?.name;
  return [
    {
      href: "/settings/business",
      title: "Business profile",
      description: `Logo, address, ${market.taxId.label}, payment instructions and document defaults.`,
      icon: BuildingIcon,
    },
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
      href: "/settings/security",
      title: "Security",
      description: "See the devices signed in to your account and sign them out.",
      icon: ShieldCheckIcon,
    },
  ];
}

export default async function SettingsPage() {
  const { market } = await requireOrgContext();
  return (
    <>
      <PageHeader title="Settings" description="Your business details, document defaults and account." />
      <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {sectionsFor(market).map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.title}>
              <Link
                href={section.href}
                className="flex items-center gap-4 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-accent"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background">
                  <Icon aria-hidden="true" className="size-4 text-ink-subtle" />
                </span>
                <span className="grid flex-1 gap-0.5">
                  <span className="font-medium">{section.title}</span>
                  <span className="text-sm text-pretty text-muted-foreground">{section.description}</span>
                </span>
                <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
