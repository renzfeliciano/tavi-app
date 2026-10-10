import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Primary and secondary actions, right-aligned on wide screens. */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="grid min-w-0 gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance [overflow-wrap:anywhere] lg:text-3xl">{title}</h1>
        {description && (
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex max-w-full flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}
