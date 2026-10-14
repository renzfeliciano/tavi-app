import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app-shell/back-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { can } from "@/modules/authz";
import { getCustomer } from "@/modules/customers";
import { requireOrgContext } from "@/modules/identity";
import { pendingPaymentsForCustomer } from "@/modules/payments";
import { todayIn } from "@/shared/dates/calendar";
import { CertificateForm } from "../_components/certificate-form";
import { CustomerChooser } from "../_components/customer-chooser";
import { formPayments, newCertificate } from "../_lib/form-data";

export const metadata: Metadata = { title: "Record a withholding certificate" };

// Recording a certificate a customer sent: pick the customer, then fill in what the form says.
export default async function NewCertificatePage({ searchParams }: PageProps<"/payments/withholding/new">) {
  const ctx = await requireOrgContext();
  const certificate = ctx.market.taxWithheld?.certificate;
  if (!certificate || !can(ctx, "payments.record")) notFound();
  const params = await searchParams;
  const requested = Array.isArray(params.customer) ? params.customer[0] : params.customer;
  const customer = requested ? await getCustomer(ctx, requested) : null;
  const back = <BackLink href={"/payments/withholding" as Route}>Withholding</BackLink>;

  if (!customer) {
    return (
      <>
        {back}
        <PageHeader title={`Who sent this ${certificate.short}?`} description={`Choose the customer who withheld the tax. The ${certificate.name} is recorded under them.`} />
        <div className="mt-8">
          <CustomerChooser />
        </div>
      </>
    );
  }

  const today = todayIn(ctx.timezone);
  const payments = formPayments(await pendingPaymentsForCustomer(ctx, customer.id), ctx.market.currency);
  return (
    <>
      {back}
      <PageHeader title={`Record a ${certificate.short}`} description={`The ${certificate.name} from ${customer.displayName}, as it is printed.`} />
      <div className="mt-8 max-w-3xl">
        <CertificateForm
          customerName={customer.displayName}
          initial={newCertificate(customer, payments, today)}
          pendingPayments={payments}
          atcs={ctx.market.withholdingAtcs}
          currency={ctx.market.currency}
          locale={ctx.locale}
          today={today}
          certificate={certificate}
          tinLabel={ctx.market.taxId.label}
          tinExample={ctx.market.taxId.example}
          examples={ctx.market.examples}
          scan={null}
        />
      </div>
    </>
  );
}
