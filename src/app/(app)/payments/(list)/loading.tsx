import { ListSkeleton, LoadingScreen, PageHeaderSkeleton, TextSkeleton, vary } from "@/components/skeletons";

// Payments: header, then rows of receipt number, date and method, and amount.
export default function PaymentsLoading() {
  return (
    <LoadingScreen label="Loading payments">
      <PageHeaderSkeleton title="w-32" description="w-72" />
      <ListSkeleton
        className="mt-8"
        row={(i) => (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3.5 sm:px-6">
            <div className="min-w-0">
              <TextSkeleton width="w-20" />
              <TextSkeleton width={vary(["w-40", "w-36", "w-44"], i)} />
            </div>
            <TextSkeleton width="w-20" />
          </div>
        )}
      />
    </LoadingScreen>
  );
}
