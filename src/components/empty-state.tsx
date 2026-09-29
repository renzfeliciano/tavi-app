import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandMascot, type MascotExpression } from "./brand/brand-mascot";

type EmptyStateProps = {
  /** What is this? e.g. "No customers yet". */
  title: string;
  /** Why it matters and what happens next. */
  description: ReactNode;
  /** The next step, usually one primary button. */
  action?: ReactNode;
  expression?: MascotExpression;
  headingLevel?: 2 | 3;
  className?: string;
};

/** Every empty list answers: what is this, why it matters, what to do next (§29). */
export function EmptyState({
  title,
  description,
  action,
  expression = "curious",
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <BrandMascot expression={expression} size="lg" />
      <Heading className="mt-1 text-base font-semibold text-balance text-foreground">
        {title}
      </Heading>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
