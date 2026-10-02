import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CustomerFormSkeleton } from "../_components/customer-form-skeleton";

// A customer: the way back, their name and archive button, then their form.
export default function CustomerLoading() {
  return (
    <LoadingScreen label="Loading customer">
      <PageHeaderSkeleton back title="w-48" description="w-72" wraps="w-20" actions={["w-28"]} />
      <CustomerFormSkeleton />
    </LoadingScreen>
  );
}
