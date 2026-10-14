import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { getCertificate } from "@/modules/payments";
import { CertificateActions } from "../../_components/certificate-actions";
import { quarterLabel } from "../../_components/certificate-list";
import { CertificateView } from "../../_components/certificate-view";

export const metadata: Metadata = { title: "Withholding certificate" };

// One recorded certificate: what the form says, the payments it covers and the scan.
export default async function CertificatePage({ params }: PageProps<"/payments/withholding/[id]">) {
  const ctx = await requireOrgContext();
  const certificate = ctx.market.taxWithheld?.certificate;
  if (!certificate) notFound();
  const { id } = await params;
  const detail = await getCertificate(ctx, id);
  if (!detail) notFound();

  return (
    <>
      <BackLink href={"/payments/withholding" as Route}>Withholding</BackLink>
      <PageHeader
        title={`${certificate.short} from ${detail.payorName}`}
        description={`${quarterLabel(detail.periodFrom)} · ${detail.customerName}`}
        actions={
          <CertificateActions
            certificateId={detail.id}
            short={certificate.short}
            payorName={detail.payorName}
            paymentCount={detail.payments.length}
            canEdit={can(ctx, "payments.record")}
            canVoid={can(ctx, "payments.void")}
            canDelete={can(ctx, "records.delete")}
            voided={detail.voidedAt !== null}
          />
        }
      />
      <CertificateView detail={detail} locale={ctx.locale} certificate={certificate} />
    </>
  );
}
