import { EmailReceiptDialog } from "./email-receipt-dialog";
import { VoidReceiptDialog } from "./void-receipt-dialog";

type ReceiptActionsProps = {
  receiptId: string;
  receiptNumber: string;
  /** The payer's customer email, offered as the first place to send a copy. */
  customerEmail: string | null;
  canEmail: boolean;
  canVoid: boolean;
  voided: boolean;
};

/** Email a copy and Void for a receipt, each only for someone allowed to, and neither once it is void. */
export function ReceiptActions({ receiptId, receiptNumber, customerEmail, canEmail, canVoid, voided }: ReceiptActionsProps) {
  if (voided || (!canEmail && !canVoid)) return null;
  return (
    <>
      {canEmail && <EmailReceiptDialog receiptId={receiptId} receiptNumber={receiptNumber} customerEmail={customerEmail} />}
      {canVoid && <VoidReceiptDialog receiptId={receiptId} receiptNumber={receiptNumber} />}
    </>
  );
}
