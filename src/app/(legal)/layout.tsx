import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { LegalBack } from "@/components/legal/legal-back";
import { LegalLinks } from "@/components/legal/legal-document";
import { brand } from "@/config/brand";

/** Public reading pages: the Terms of Service and the Privacy Notice. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header className="mx-auto mb-10 flex w-full max-w-2xl items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center rounded-sm pointer-coarse:min-h-11" aria-label={`${brand.name} home`}>
          <Wordmark size={24} />
        </Link>
        <LegalBack />
      </header>
      <main className="mx-auto w-full max-w-2xl">{children}</main>
      <footer className="mx-auto mt-16 grid w-full max-w-2xl justify-items-center gap-3 border-t border-border pt-6">
        <LegalBack />
        <LegalLinks />
        <p className="text-center text-xs text-muted-foreground">{brand.taglines.primary}</p>
      </footer>
    </div>
  );
}
