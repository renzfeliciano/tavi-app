import { type ReactNode, useId } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * A white section sheet inside a long form: heading, one-line purpose, a
 * hairline rule, then fields in two columns on wide screens (DESIGN.md,
 * "Settings forms").
 */
export function FormSection({ title, description, children }: FormSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card shadow-xs">
      <header className="grid gap-0.5 border-b border-border px-5 py-4 sm:px-6">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </header>
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">{children}</div>
    </section>
  );
}
