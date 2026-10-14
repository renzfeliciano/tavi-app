import type { Route } from "next";
import Link from "next/link";
import { ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, type LucideIcon } from "lucide-react";
import type { RowState } from "../_lib/row-states";

export type SettingsSection = { href: Route; title: string; description: string; icon: LucideIcon; state?: RowState };

/** What a row's state looks like: done and to-do carry an icon as well as the words; a plain count is just words. */
function StateTag({ state }: { state: RowState }) {
  const Icon = state.tone === "done" ? CircleCheckIcon : state.tone === "todo" ? CircleAlertIcon : null;
  return (
    <span data-testid="row-state" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />}
      {state.text}
    </span>
  );
}

/** The Settings overview: one row per area, each with its icon, name, a short state and what it is for. */
export function SettingsList({ sections }: { sections: SettingsSection[] }) {
  return (
    <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <li key={section.title}>
            <Link
              href={section.href}
              className="flex items-center gap-4 px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background">
                <Icon aria-hidden="true" className="size-4 text-ink-subtle" />
              </span>
              <span className="grid flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-x-3">
                  <span className="font-medium">{section.title}</span>
                  {section.state && <StateTag state={section.state} />}
                </span>
                <span className="text-sm text-pretty text-muted-foreground">{section.description}</span>
              </span>
              <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
