import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/modules/authz";
import { listRegistrationDocuments } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";
import {
  filingsKnown,
  getBusinessRegistration,
  registeringOffice,
  upcomingDeadlines,
} from "@/modules/organizations";
import { formatCalendarDate, todayIn } from "@/shared/dates/calendar";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { DeadlinesCard } from "./deadlines-card";
import { DocumentsCard } from "./documents-card";
import { RegistrationForm, type RegistrationCopy } from "./registration-form";
import type { RegistrationValues } from "./actions";

export const metadata: Metadata = { title: "Registration" };

export default async function RegistrationPage() {
  const ctx = await requireOrgContext();
  const config = ctx.market.registration;
  if (!config) notFound();

  const { authority } = config;
  // These papers carry tax numbers and home addresses: owners and admins only.
  if (!can(ctx, "organization.manage")) {
    return (
      <>
        <SettingsPageHeader title="Registration" description={`${authority} and business name registration, filing dates and certificates.`} />
        <p className="mt-6 rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-ink-subtle">
          Only owners and admins can see registration details.
        </p>
      </>
    );
  }

  const [registration, documents] = await Promise.all([getBusinessRegistration(ctx), listRegistrationDocuments(ctx)]);
  const today = todayIn(ctx.timezone);
  const deadlines = upcomingDeadlines(config, registration, today);
  const taxRegistration = ctx.market.taxRegistrations.find((r) => r.code === registration.taxRegistration);
  const office = registeringOffice(registration.taxId, config);

  let missing: { text: string; href: "/settings/business" | null } | null = null;
  if (!registration.taxRegistration) {
    missing = { text: `Set how you're registered for tax in your business profile to see your ${authority} return dates.`, href: "/settings/business" };
  } else if (!filingsKnown(config, registration)) {
    missing = { text: "Choose your taxpayer type below to see your income tax return dates.", href: null };
  }

  const initial = Object.fromEntries(
    Object.entries(registration)
      .filter(([key]) => !["taxId", "taxRegistration", "timezone"].includes(key))
      .map(([key, value]) => [key, value ?? ""]),
  ) as RegistrationValues;

  const copy: RegistrationCopy = {
    authority,
    taxpayerTypes: config.taxpayerTypes.map((t) => ({ ...t })),
    incomeTaxOptions: config.incomeTaxOptions.map((o) => ({ ...o })),
    office: { label: config.office.label, hint: config.office.hint, example: config.office.example },
    taxRegisteredOnLabel: config.taxRegisteredOnLabel,
    lineOfBusinessHint: config.lineOfBusinessHint,
    industryCode: { label: config.industryCode.label, hint: config.industryCode.hint, example: config.industryCode.example },
    authorities: config.nameRegistration.authorities.map((a) => ({ ...a })),
    scopes: config.nameRegistration.scopes.map((s) => ({ ...s })),
  };

  return (
    <>
      <SettingsPageHeader
        title="Registration"
        description={`Your ${authority} and business name registration, the returns and renewals that follow, and your certificates.`}
      />
      <div className="mt-8 grid max-w-3xl gap-8">
        <section aria-labelledby="tax-id-heading" className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs sm:px-6">
          <h2 id="tax-id-heading" className="font-semibold">
            {ctx.market.taxId.label} and tax status
          </h2>
          {registration.taxId ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">{ctx.market.taxId.label}</dt>
              <dd className="font-mono">{registration.taxId}</dd>
              <dt className="text-muted-foreground">Registering office</dt>
              <dd>
                {office.kind === "head_office" && "Head office"}
                {office.kind === "branch" && `Branch ${office.code}`}
                {office.kind === "unknown" && "Add the branch code after your TIN (00000 for the head office) to show it on your documents."}
              </dd>
              <dt className="text-muted-foreground">Tax registration</dt>
              <dd>{taxRegistration?.label ?? "Not set yet"}</dd>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-pretty text-muted-foreground">
              Add your {ctx.market.taxId.label} in your business profile. Include the branch code (00000 for the head office).
            </p>
          )}
          <p className="mt-3 text-sm">
            <Link href="/settings/business" className="font-medium text-foreground underline underline-offset-4">
              Change in business profile
            </Link>
          </p>
        </section>

        <DeadlinesCard deadlines={deadlines} locale={ctx.locale} note={config.deadlinesNote} missing={missing} />
        <RegistrationForm initial={initial} copy={copy} editable />
        <DocumentsCard
          documents={documents.map((d) => ({
            id: d.id,
            kind: d.kind,
            fileName: d.fileName,
            contentType: d.contentType,
            byteSize: d.byteSize,
            addedOn: formatCalendarDate(todayIn(ctx.timezone, d.createdAt), ctx.locale),
          }))}
          kinds={config.documentKinds.map((k) => ({ ...k }))}
          editable
        />
      </div>
    </>
  );
}
