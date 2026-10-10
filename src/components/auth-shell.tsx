import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import { AuthMascot, AuthStageProvider } from "@/components/auth-stage";
import { Wordmark } from "@/components/brand/wordmark";
import { LegalLinks } from "@/components/legal/legal-document";
import { brand } from "@/config/brand";

/** The three moments of a job, in order. The last one is the point of it all, so it carries the check. */
const FLOW = [
  ["Quote", "approved"],
  ["Invoice", "sent"],
  ["Payment", "recorded"],
] as const;

/**
 * Sign-in, sign-up, reset and onboarding. On wide screens the Stamp sits on a
 * sunken sheet beside the form; on a phone the form has the page to itself.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthStageProvider>
    <div className="auth-shell group/auth grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface-sunken p-12 lg:flex"
      >
        <Link href="/" tabIndex={-1} className="w-fit group-has-data-[branded]/auth:invisible">
          <Wordmark size={26} />
        </Link>

        <div className="mx-auto grid w-full max-w-xs justify-items-center gap-10">
          <AuthMascot size="xl" />
          <ol className="relative w-full font-mono text-sm before:absolute before:top-6 before:bottom-6 before:left-[0.6875rem] before:w-px before:bg-foreground/25">
            {FLOW.map(([what, state], i) => {
              const last = i === FLOW.length - 1;
              return (
                <li key={what} className="relative grid grid-cols-[1.375rem_1fr_auto] items-center gap-x-4 py-3">
                  <span
                    className={
                      last
                        ? "relative z-10 grid size-[1.375rem] place-items-center rounded-full bg-stamp text-white"
                        : "relative z-10 grid size-[1.375rem] place-items-center rounded-full border border-foreground/40 bg-surface-sunken text-[0.65rem] text-foreground tabular-nums"
                    }
                  >
                    {last ? <CheckIcon className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="font-semibold">{what}</span>
                  <span className="text-muted-foreground">{state}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="text-sm text-muted-foreground">{brand.taglines.primary}</p>
      </aside>

      <div className="flex flex-col items-center px-4 py-10 sm:py-14 lg:justify-center lg:px-12">
        <div className="mb-6 grid justify-items-center gap-3 lg:hidden">
          <Link href="/" className="rounded-sm group-has-data-[branded]/auth:hidden">
            <Wordmark size={24} />
          </Link>
          <AuthMascot size="lg" />
        </div>
        <main className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:max-w-md lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {children}
        </main>
        <footer className="mt-10 grid gap-2 lg:mt-14">
          <p className="text-center text-xs text-muted-foreground lg:hidden">{brand.taglines.primary}</p>
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
