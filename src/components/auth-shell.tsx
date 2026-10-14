import Link from "next/link";
import type { ReactNode } from "react";
import { AuthSlip } from "@/components/auth-slip";
import { AuthMascot, AuthStageProvider } from "@/components/auth-stage";
import { Tagline } from "@/components/brand/tagline";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeCorner } from "@/components/theme/theme-toggle";
import { LegalLinks } from "@/components/legal/legal-document";

/**
 * Sign-in, sign-up, reset and onboarding. On wide screens the Stamp sits on a
 * sunken sheet beside the form; on a phone the form has the page to itself.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthStageProvider>
    <div className="auth-shell group/auth grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <ThemeCorner />
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-sunken p-12 lg:flex"
      >
        <Link href="/" tabIndex={-1} className="w-fit group-has-data-[branded]/auth:invisible">
          <Wordmark size={26} mark />
        </Link>

        <div className="mx-auto grid w-full max-w-xs justify-items-center gap-8">
          <AuthMascot size="xl" />
          <AuthSlip />
        </div>

        <p className="text-sm text-muted-foreground">
          <Tagline />
        </p>
      </aside>

      <div className="flex flex-col items-center px-4 py-10 sm:py-14 lg:justify-center lg:px-12">
        <div className="mb-6 grid justify-items-center gap-3 lg:hidden">
          <Link href="/" className="rounded-sm group-has-data-[branded]/auth:hidden">
            <Wordmark size={24} mark />
          </Link>
          <AuthMascot size="lg" />
        </div>
        <main className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:max-w-md lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {children}
        </main>
        <footer className="mt-10 grid gap-2 lg:mt-14">
          <p className="text-center text-xs text-muted-foreground lg:hidden">
            <Tagline />
          </p>
          <LegalLinks />
        </footer>
      </div>
    </div>
    </AuthStageProvider>
  );
}

/**
 * `withBrand` sets the TAVI wordmark inline after the title ("Sign in to TAVI")
 * and takes the shell's own wordmark away, so the name appears once.
 */
export function AuthHeading({
  title,
  description,
  withBrand = false,
}: {
  title: string;
  description?: ReactNode;
  withBrand?: boolean;
}) {
  return (
    <div className="mb-8 grid gap-2" data-branded={withBrand ? "" : undefined}>
      <h1 className="flex flex-wrap items-end gap-x-2.5 text-2xl font-semibold tracking-tight text-balance">
        {title}
        {withBrand && <Wordmark size={28} />}
      </h1>
      {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}
