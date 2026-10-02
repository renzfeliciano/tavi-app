import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, LockIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { LEGAL_PATHS } from "@/config/legal";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { CloseAccountDialog } from "./close-account-dialog";

export const metadata: Metadata = { title: "Account and data" };

// Personal-data rights in the app (D16): download a copy, close the account.
export default async function AccountPage() {
  const ctx = await requireOrgContext();
  const canExport = can(ctx, "organization.manage");

  return (
    <>
      <SettingsPageHeader
        title="Account and data"
        description={
          <>
            Take a copy of your data, or close your account. The{" "}
            <Link href={LEGAL_PATHS.privacy} className="font-medium text-foreground underline underline-offset-4">
              Privacy Notice
            </Link>{" "}
            explains what {brand.name} keeps and why.
          </>
        }
      />

      <section
        aria-labelledby="export-heading"
        className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="export-heading" className="font-semibold">
          Download your data
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          One file with everything {ctx.organizationName} keeps in {brand.name}: the business profile, customers,
          products and services, tax rates, quotes, bills and payments. It&apos;s a JSON file, which other apps and
          developers can read.
        </p>
        {canExport ? (
          <a
            href="/settings/account/export"
            download
            className={buttonVariants({ variant: "outline", className: "w-fit" })}
          >
            <DownloadIcon aria-hidden="true" data-icon="inline-start" />
            Download your data
          </a>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-ink-subtle">
            <LockIcon aria-hidden="true" className="size-4 shrink-0" />
            Only owners and admins can download the business&apos;s data.
          </p>
        )}
      </section>

      <section
        aria-labelledby="close-heading"
        className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="close-heading" className="font-semibold">
          Close your account
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Removes your sign-in, your name and your email. A business only you use is closed, and the documents and
          payments it issued are kept as tax rules require; you leave any business you share with others. Download
          your data first if you want a copy.
        </p>
        <div>
          <CloseAccountDialog />
        </div>
      </section>
    </>
  );
}
