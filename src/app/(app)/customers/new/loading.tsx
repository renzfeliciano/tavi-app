import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CustomerFormSkeleton } from "../_components/customer-form-skeleton";

// Adding a customer: the way back, the header, then the empty form.
export default function NewCustomerLoading() {
  return (
    <LoadingScreen label="Loading new customer form">
      <PageHeaderSkeleton back title="w-40" description="w-96" wraps="w-24" />
      <CustomerFormSkeleton />
    </LoadingScreen>
  );
}
