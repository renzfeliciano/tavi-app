import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeftIcon, LockIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";

/** A settings sub-page header with the way back to Settings. */
export function SettingsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <Link
        href="/settings"
        className="-ml-1 mb-3 inline-flex items-center gap-1 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground pointer-coarse:py-2.5"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
        Settings
      </Link>
      <PageHeader title={title} description={description} actions={actions} />
    </>
  );
}

/** Tells members why the controls are disabled, instead of hiding the page. */
export function ReadOnlyNotice() {
  return (
    <p className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-ink-subtle">
      <LockIcon aria-hidden="true" className="size-4 shrink-0" />
      Only owners and admins can change these settings.
    </p>
  );
}
