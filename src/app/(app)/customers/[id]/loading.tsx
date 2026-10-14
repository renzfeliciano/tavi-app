import { LoadingScreen, PageHeaderSkeleton, SummaryStripSkeleton } from "@/components/skeletons";
import { CustomerFormSkeleton } from "../_components/customer-form-skeleton";
import { RecentDocumentsSkeleton } from "../_components/recent-documents";

// A customer: the way back, their name and archive button, their money strip, their latest quotations
// and billing statements side by side, then the details form.
export default function CustomerLoading() {
  return (
    <LoadingScreen label="Loading customer">
      <PageHeaderSkeleton back title="w-48" description="w-72" wraps="w-20" actions={["w-28"]} />
      <SummaryStripSkeleton phoneHides={2} />
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <RecentDocumentsSkeleton />
        <RecentDocumentsSkeleton />
      </div>
      <CustomerFormSkeleton className="mt-10" />
    </LoadingScreen>
  );
}
