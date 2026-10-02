import {
  ButtonSkeleton,
  DocumentPaperSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// A sent bill: the way back, its number, status and actions, its payments, then the bill itself.
export default function InvoiceLoading() {
  return (
    <LoadingScreen label="Loading bill">
      <PageHeaderSkeleton back badge title="w-56" description="w-64" actions={["w-28", "w-24"]} />
      <div className="mt-8 max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <TextSkeleton size="base" width="w-24" />
            <TextSkeleton width="w-44" />
          </div>
          <ButtonSkeleton width="w-36" />
        </div>
      </div>
      <div className="mt-6 max-w-3xl">
        <DocumentPaperSkeleton />
      </div>
    </LoadingScreen>
  );
}
