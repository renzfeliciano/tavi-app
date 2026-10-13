import {
  ListSearchSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SummaryStripSkeleton,
} from "@/components/skeletons";
import { QuoteListSkeleton } from "../../_documents/document-list";

// The quote list: header, the summary strip, search and status tabs, then the table of quotations.
export default function QuotesLoading() {
  return (
    <LoadingScreen label="Loading quotations">
      <PageHeaderSkeleton title="w-28" description="w-88" actions={["w-32"]} />
      <SummaryStripSkeleton phoneHides={0} />
      <div className="mt-5 grid gap-3">
        <ListSearchSkeleton />
        <ListViewsSkeleton views={["w-12", "w-16", "w-14", "w-20", "w-20", "w-16", "w-20"]} />
      </div>
      <QuoteListSkeleton label="Quotation list" />
    </LoadingScreen>
  );
}
