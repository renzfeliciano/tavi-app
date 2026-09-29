import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { MascotExpression } from "@/components/brand/brand-mascot";

type SectionEmptyProps = {
  title: string;
  description: ReactNode;
  action?: { href: Route; label: string; icon?: LucideIcon };
  expression?: MascotExpression;
};

/** An empty section: the §29 empty state on a sheet of paper. */
export function SectionEmpty({ title, description, action, expression }: SectionEmptyProps) {
  const Icon = action?.icon;
  return (
    <div className="mt-8 rounded-xl border border-border bg-card shadow-xs">
      <EmptyState
        title={title}
        description={description}
        expression={expression}
        action={
          action && (
            <Link href={action.href} className={buttonVariants()}>
              {Icon && <Icon aria-hidden="true" />}
              {action.label}
            </Link>
          )
        }
      />
    </div>
  );
}
