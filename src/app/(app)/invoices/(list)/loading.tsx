import {
  ListSearchSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SummaryStripSkeleton,
} from "@/components/skeletons";
import { InvoiceListSkeleton } from "../../_documents/document-list";

// The bill list: header, the summary strip, search and status tabs, then the table of billing statements.
export default function InvoicesLoading() {
  return (
    <LoadingScreen label="Loading billing statements">
      <PageHeaderSkeleton title="w-36" description="w-96" wraps="w-16" actions={["w-36"]} />
      <SummaryStripSkeleton phoneHides={2} />
      <div className="mt-5 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-12", "w-16", "w-14", "w-20", "w-24", "w-14", "w-20", "w-16"]} />
      </div>
      <InvoiceListSkeleton label="Billing statement list" />
    </LoadingScreen>
  );
}
