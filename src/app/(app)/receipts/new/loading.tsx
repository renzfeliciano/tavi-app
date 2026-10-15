import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { ReceiptFormSkeleton } from "../_components/receipt-form-skeleton";

// Making a receipt: the way back, the header, then the form.
export default function NewReceiptLoading() {
  return (
    <LoadingScreen label="Loading the form">
      <PageHeaderSkeleton back title="w-40" description="w-96" wraps="w-24" />
      <ReceiptFormSkeleton />
    </LoadingScreen>
  );
}
