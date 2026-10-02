import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { LEGAL, legalDetail } from "@/config/legal";

export const metadata: Metadata = { title: "Account closed" };

/** Where closing an account lands (D16). Needs no session: there isn't one any more. */
export default function AccountClosedPage() {
  return (
    <>
      <AuthHeading title="Your account is closed" />
      <div className="grid gap-4 text-sm text-pretty">
        <p>
          You&apos;ve been signed out everywhere, your password no longer works, and your name and email have been
          removed from {brand.name}. Your customer links have stopped working.
        </p>
        <p>
          The documents and payments your business issued are kept for as long as tax rules require.
        </p>
        <p>
          Questions? Write to <span className="font-medium">{legalDetail(LEGAL.operator.privacyEmail)}</span>.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
          Back to {brand.name}
        </Link>
      </div>
    </>
  );
}
