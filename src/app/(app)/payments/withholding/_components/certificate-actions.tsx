import type { Route } from "next";
import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { buttonVariants } from "@/components/ui/button";
import { deleteCertificateAction } from "../actions";
import { VoidCertificateDialog } from "./void-certificate-dialog";

type CertificateActionsProps = {
  certificateId: string;
  short: string;
  payorName: string;
  paymentCount: number;
  canEdit: boolean;
  canVoid: boolean;
  /** The owner: a void certificate can be moved to the recycle bin. */
  canDelete?: boolean;
  voided: boolean;
};

/** Edit and Void for a certificate, each only for someone allowed to, and neither once it is void; then the owner may delete it. */
export function CertificateActions({ certificateId, short, payorName, paymentCount, canEdit, canVoid, canDelete = false, voided }: CertificateActionsProps) {
  if (voided) {
    if (!canDelete) return null;
    return (
      <DeleteRecordButton
        name={`${short} from ${payorName}`}
        description="Its scan is deleted with it, and a restored copy comes back without the scan."
        remove={deleteCertificateAction.bind(null, certificateId)}
        redirectTo="/payments/withholding"
      />
    );
  }
  if (!canEdit && !canVoid) return null;
  return (
    <>
      {canEdit && (
        <Link href={`/payments/withholding/${certificateId}/edit` as Route} className={buttonVariants({ variant: "outline" })}>
          <PencilIcon aria-hidden="true" />
          Edit
        </Link>
      )}
      {canVoid && <VoidCertificateDialog certificateId={certificateId} short={short} payorName={payorName} paymentCount={paymentCount} />}
    </>
  );
}
