import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { brand } from "@/config/brand";

/** Centered sheet of paper for sign-in, sign-up, reset and onboarding. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:justify-center sm:py-16">
      <Link href="/" className="mb-8 rounded-sm">
        <Wordmark size={24} />
      </Link>
      <main className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </main>
      <p className="mt-8 text-center text-xs text-muted-foreground">{brand.taglines.primary}</p>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6 grid gap-1.5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}
