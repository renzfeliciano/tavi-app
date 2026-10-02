import {
  ListSearchSkeleton,
  ListSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { DocumentRowSkeleton } from "../../_documents/document-row-skeleton";

// The bill list: header, search and status tabs, then rows of number, customer, status and amount.
export default function InvoicesLoading() {
  return (
    <LoadingScreen label="Loading bills">
      <PageHeaderSkeleton title="w-36" description="w-96" wraps="w-16" actions={["w-36"]} />
      <div className="mt-8 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-12", "w-16", "w-14", "w-20", "w-24", "w-14", "w-20", "w-16"]} />
      </div>
      <ListSkeleton className="mt-4" row={(i) => <DocumentRowSkeleton index={i} />} />
    </LoadingScreen>
  );
}
