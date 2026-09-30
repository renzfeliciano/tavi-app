import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

// A record that doesn't exist, or belongs to another business: both look
// the same, so nothing leaks about other tenants (§8).
export default function AppNotFound() {
  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-xs">
      <EmptyState
        title="We couldn't find that"
        description="It may have been removed, or the link is wrong."
        expression="curious"
        action={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Go to dashboard
          </Link>
        }
      />
    </div>
  );
}
