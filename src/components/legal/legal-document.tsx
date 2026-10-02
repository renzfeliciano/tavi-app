import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL, LEGAL_PATHS, missingLegalDetails } from "@/config/legal";
import { DEFAULT_MARKET, MARKETS } from "@/config/markets";
import { cn } from "@/lib/utils";

// Long-form reading for the Terms of Service and Privacy Notice (1.13b).
// Public pages step body text up to 16px (DESIGN.md, Typography).

/** "2 October 2026" for a YYYY-MM-DD version, in the site's default locale. */
export function formatLegalDate(isoDate: string): string {
  return new Intl.DateTimeFormat(MARKETS[DEFAULT_MARKET].locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function LegalDocument({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  const missing = missingLegalDetails();
  return (
    <article className="grid gap-8">
      <header className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Version of {formatLegalDate(LEGAL.version)}. Applies from that date.
        </p>
        {missing.length > 0 && (
          <p className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
            <strong className="font-semibold">Draft.</strong> This document is still being prepared. Before launch we&apos;ll
            add the {joinWords(missing)}.
          </p>
        )}
        <div className="text-base text-pretty">{intro}</div>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 text-base text-pretty [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="grid list-disc gap-2 pl-5 marker:text-muted-foreground">{children}</ul>;
}

/** "Terms · Privacy" links for footers on public and sign-in pages. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn("flex items-center justify-center gap-4 text-xs text-muted-foreground", className)}>
      <Link
        href={LEGAL_PATHS.terms}
        className="inline-flex items-center underline-offset-4 hover:underline pointer-coarse:min-h-11"
      >
        Terms
      </Link>
      <Link
        href={LEGAL_PATHS.privacy}
        className="inline-flex items-center underline-offset-4 hover:underline pointer-coarse:min-h-11"
      >
        Privacy
      </Link>
    </nav>
  );
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
