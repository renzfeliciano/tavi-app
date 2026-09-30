"use client";

import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";

// Something failed while loading an app page. Human copy and a retry (§28);
// the server already logged the details under the request ID.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-xs">
      <EmptyState
        title="This page didn't load"
        description="Nothing you saved was lost. Try again, and if it keeps happening, come back in a few minutes."
        expression="concerned"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => retry()}>Try again</Button>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Go to dashboard
            </Link>
          </div>
        }
      />
      {error.digest && (
        <p className="pb-6 text-center font-mono text-xs text-muted-foreground">Reference {error.digest}</p>
      )}
    </div>
  );
}
