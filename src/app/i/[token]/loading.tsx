import { PortalDocumentSkeleton } from "@/components/skeletons";

// A shared bill: who it's from and its status, the balance and how to pay, then the bill.
export default function SharedInvoiceLoading() {
  return <PortalDocumentSkeleton label="Loading bill" balance />;
}
