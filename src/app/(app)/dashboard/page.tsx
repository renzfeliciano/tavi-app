import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRightIcon, BellIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import type { MarketProfile } from "@/config/markets";
import { cn } from "@/lib/utils";
import { requireOrgContext } from "@/modules/identity";

export const metadata: Metadata = { title: "Dashboard" };

// First-run checklist (§G.5). Each step reads its completion from the
// organization once the dashboard milestone (1.10) tracks it.
type Step = { title: string; description: string; href: Route; cta: string };

function setupSteps(market: MarketProfile): Step[] {
  return [
    {
      title: "Add your first customer",
      description: "Their name and contact details fill in on every quote and invoice.",
      href: "/customers/new",
      cta: "Add customer",
    },
    {
      title: "Create a quote",
      description: `List the work and your price. ${brand.name} does the totals and tax.`,
      href: "/quotes/new",
      cta: "New quote",
    },
    {
      title: "Send it",
      description: `Email it, or copy the link into ${market.shareChannels}. They can approve it from their phone.`,
      href: "/quotes",
      cta: "Go to quotes",
    },
  ];
}

export default async function DashboardPage() {
  const { market } = await requireOrgContext();
  const steps = setupSteps(market);
  return (
    <>
      <PageHeader
        title={`Welcome to ${brand.name}`}
        description="Three steps to your first sent quote."
      />

      <section
        aria-labelledby="setup-heading"
        className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      >
        <div className="flex items-center gap-4 border-b border-border px-5 py-4 sm:px-6">
          <BrandMascot expression="happy" size="sm" />
          <div className="grid gap-0.5">
            <h2 id="setup-heading" className="font-semibold">
              Get ready to send your first quote
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">
              Your logo and business details can wait.{" "}
              <Link href="/settings/business" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                Add them now
              </Link>
            </p>
          </div>
        </div>

        <ol className="divide-y divide-border">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "row-span-2 mt-px grid size-7 shrink-0 place-items-center self-start rounded-full border font-mono text-xs tabular-nums sm:row-span-1 sm:mt-0 sm:self-center",
                  index === 0
                    ? "border-stamp bg-stamp-subtle text-stamp"
                    : "border-border-strong text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <div className="grid gap-0.5">
                <span className="font-medium">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </span>
                <span className="text-sm text-pretty text-muted-foreground">
                  {step.description}
                </span>
              </div>
              <Link
                href={step.href}
                className={cn(
                  buttonVariants({ variant: index === 0 ? "default" : "outline" }),
                  "col-start-2 justify-self-start sm:col-start-3",
                )}
              >
                {step.cta}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="attention-heading" className="mt-10">
        <h2 id="attention-heading" className="text-base font-semibold">
          Needs your attention
        </h2>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">
          <BellIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="text-pretty">
            Nothing yet. Overdue invoices, approved quotes waiting to be invoiced,
            and quotes customers haven&apos;t answered will show up here.
          </p>
        </div>
      </section>
    </>
  );
}
