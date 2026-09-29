import { cn } from "@/lib/utils";

type DocumentNumberProps = {
  /** The issued serial (e.g. "QUO-000124"), or null for an unissued draft. */
  number: string | null;
  className?: string;
};

/**
 * Document serial, set like a pre-printed receipt number: mono, tabular, in
 * stamp ink. Drafts have no number yet (numbers are assigned on issue, §B.6).
 */
export function DocumentNumber({ number, className }: DocumentNumberProps) {
  if (number === null) {
    return (
      <span className={cn("font-mono text-muted-foreground", className)}>Draft</span>
    );
  }
  return (
    <span
      className={cn(
        "font-mono tabular-nums whitespace-nowrap text-stamp",
        className,
      )}
    >
      <span aria-hidden="true">Nº </span>
      {number}
    </span>
  );
}
