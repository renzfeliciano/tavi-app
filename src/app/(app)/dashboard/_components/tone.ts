/** The wash and ink of a small round mark, by what it says. Semantic tokens only (DESIGN.md, "Colors"). */
export type Tone = "danger" | "success" | "info" | "warning" | "muted";

export const MARK: Record<Tone, string> = {
  danger: "bg-danger-subtle text-danger-strong",
  success: "bg-success-subtle text-success-strong",
  info: "bg-info-subtle text-info-strong",
  warning: "bg-warning-subtle text-warning-strong",
  muted: "bg-surface-sunken text-ink-subtle",
};

/** The ink alone, for an icon that sits on the sheet itself. */
export const INK: Record<Tone, string> = {
  danger: "text-danger-strong",
  success: "text-success-strong",
  info: "text-info-strong",
  warning: "text-warning-strong",
  muted: "text-muted-foreground",
};
