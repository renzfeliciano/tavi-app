import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getCertificate, pendingPaymentsForCustomer } from "@/modules/payments";
import { todayIn } from "@/shared/dates/calendar";
import { CertificateForm } from "../../_components/certificate-form";
import { editedCertificate, formPayments } from "../../_lib/form-data";

export const metadata: Metadata = { title: "Edit withholding certificate" };

// Correcting a recorded certificate. A void one can't be changed.
export default async function EditCertificatePage({ params }: PageProps<"/payments/withholding/[id]/edit">) {
  const ctx = await requireOrgContext();
  const certificate = ctx.market.taxWithheld?.certificate;
  if (!certificate || !can(ctx, "payments.record")) notFound();
  const { id } = await params;
  const detail = await getCertificate(ctx, id);
  if (!detail || detail.voidedAt) notFound();

  const today = todayIn(ctx.timezone);
  const payments = formPayments(await pendingPaymentsForCustomer(ctx, detail.customerId, { alsoOnCertificate: id }), ctx.market.currency);
  const href = `/payments/withholding/${id}` as Route;
  return (
    <>
      <BackLink href={href}>{certificate.short}</BackLink>
      <PageHeader title={`Edit ${certificate.short}`} description={`The ${certificate.name} from ${detail.customerName}.`} />
      <div className="mt-8 max-w-3xl">
        <CertificateForm
          certificateId={id}
          customerName={detail.customerName}
          initial={editedCertificate(detail, ctx.market.currency, ctx.locale)}
          pendingPayments={payments}
          atcs={ctx.market.withholdingAtcs}
          currency={ctx.market.currency}
          locale={ctx.locale}
          today={today}
          certificate={certificate}
          tinLabel={ctx.market.taxId.label}
          tinExample={ctx.market.taxId.example}
          examples={ctx.market.examples}
          scan={detail.fileId ? { fileName: detail.fileName ?? "Scan", href: `/api/files/${detail.fileId}` } : null}
          cancelHref={href}
        />
      </div>
    </>
  );
}
