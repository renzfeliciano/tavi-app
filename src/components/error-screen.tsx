"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMascot } from "@/components/brand/brand-mascot";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorScreenProps = {
  error: Error & { digest?: string };
  retry: () => void;
  /** "page" fills the screen (nothing else rendered); "inline" sits inside the app shell. */
  variant?: "page" | "inline";
  /** Where "Go to dashboard" leads; omit it to hide the button. */
  homeHref?: string;
};

/**
 * What people see when a page fails (§28). The Stamp looks concerned, we say
 * it is on our side and that nothing they saved is lost, and the way out is
 * one tap. The reference is what they can quote if it keeps happening; the
 * server already logged the details under it.
 */
export function ErrorScreen({ error, retry, variant = "page", homeHref = "/dashboard" }: ErrorScreenProps) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div
      className={cn(
        "grid place-items-center px-6 text-center",
        variant === "page" ? "min-h-dvh bg-background" : "rounded-xl border border-border bg-card py-14 shadow-xs",
      )}
    >
      <div role="alert" className="flex max-w-sm flex-col items-center gap-3">
        <BrandMascot expression="concerned" size="xl" calm />
        <h1 className="mt-2 text-xl font-semibold text-balance text-foreground">
          {offline ? "You're offline" : "That didn't load"}
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {offline
            ? "Check your connection and try again. Nothing you saved was lost."
            : "This one is on us, not you. Nothing you saved was lost. Try again, and if it keeps happening, come back in a few minutes."}
        </p>
        <div className="mt-3 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button onClick={() => retry()} className="sm:min-w-28">
            Try again
          </Button>
          {homeHref && (
            <Link href={homeHref as Route} className={buttonVariants({ variant: "outline" })}>
              Go to dashboard
            </Link>
          )}
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">
            Reference <span className="font-mono tabular-nums select-all">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
