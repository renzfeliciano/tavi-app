import type { Metadata, Route } from "next";
import Link from "next/link";
import { BuildingIcon, ChevronRightIcon, type LucideIcon, ShieldCheckIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Settings" };

const sections: { href: Route | null; title: string; description: string; icon: LucideIcon }[] = [
  {
    href: null,
    title: "Business profile",
    description: "Logo, address, tax details and payment instructions.",
    icon: BuildingIcon,
  },
  {
    href: "/settings/security",
    title: "Security",
    description: "See the devices signed in to your account and sign them out.",
    icon: ShieldCheckIcon,
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your business details, document defaults and account." />
      <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {sections.map((section) => {
          const Icon = section.icon;
          const body = (
            <>
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background">
                <Icon aria-hidden="true" className="size-4 text-ink-subtle" />
              </span>
              <span className="grid flex-1 gap-0.5">
                <span className="font-medium">{section.title}</span>
                <span className="text-sm text-pretty text-muted-foreground">{section.description}</span>
              </span>
            </>
          );
          return (
            <li key={section.title}>
              {section.href ? (
                <Link
                  href={section.href}
                  className="flex items-center gap-4 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-accent"
                >
                  {body}
                  <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <div className="flex items-center gap-4 px-5 py-4">
                  {body}
                  <span className="shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs font-medium text-ink-subtle">
                    Coming soon
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
