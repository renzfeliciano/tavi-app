import {
  ListSearchSkeleton,
  ListSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { DocumentRowSkeleton } from "../../_documents/document-row-skeleton";

// The quote list: header, search and status tabs, then rows of number, customer, status and amount.
export default function QuotesLoading() {
  return (
    <LoadingScreen label="Loading quotes">
      <PageHeaderSkeleton title="w-28" description="w-88" actions={["w-32"]} />
      <div className="mt-8 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-12", "w-16", "w-14", "w-20", "w-20", "w-16", "w-20"]} />
      </div>
      <ListSkeleton className="mt-4" row={(i) => <DocumentRowSkeleton index={i} />} />
    </LoadingScreen>
  );
}
