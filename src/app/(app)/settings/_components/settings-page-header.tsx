import type { ReactNode } from "react";
import { LockIcon } from "lucide-react";
import { BackLink } from "@/components/app-shell/back-link";
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
      <BackLink href="/settings">Settings</BackLink>
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
