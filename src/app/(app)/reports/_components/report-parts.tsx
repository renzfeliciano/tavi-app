import type { ReactNode } from "react";
import { DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// The pieces every report section is made of: its heading with the CSV button, a card of rows, and the quiet note for nothing.

export function ReportSection({
  id,
  title,
  description,
  csv,
  children,
}: {
  id: string;
  title: string;
  description: string;
  csv: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="mt-10 grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-0.5">
          <h2 id={`${id}-heading`} className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        <a href={csv} download className={buttonVariants({ variant: "outline" })}>
          <DownloadIcon aria-hidden="true" />
          Download CSV<span className="sr-only"> of {title.toLowerCase()}</span>
        </a>
      </div>
      {children}
    </section>
  );
}

export function Rows({ label, rows }: { label: string; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <h3 className="border-b border-border px-5 py-3 text-sm font-medium sm:px-6">{label}</h3>
      <dl className="divide-y divide-border">
        {rows.map(([name, value], i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6">
            <dt className="min-w-0">{name}</dt>
            <dd className="shrink-0 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted-foreground">{children}</p>
  );
}
