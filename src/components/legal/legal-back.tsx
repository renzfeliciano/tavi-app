"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The way back from the Terms or Privacy Notice. It returns to the page the
 * person came from (sign-in, sign-up, the app) when there is one in this tab,
 * and otherwise goes to sign-in, which sends someone who is already signed in to their dashboard.
 */
export function LegalBack({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Link
      href="/sign-in"
      onClick={(event) => {
        const cameFromHere = document.referrer !== "" && new URL(document.referrer).origin === window.location.origin;
        if (cameFromHere && window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
    >
      <ArrowLeftIcon aria-hidden="true" />
      Back
    </Link>
  );
}
