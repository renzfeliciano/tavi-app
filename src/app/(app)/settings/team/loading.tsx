import {
  ButtonSkeleton,
  FieldSkeleton,
  ListSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
  vary,
} from "@/components/skeletons";

// Team: the way back, the header, the invite card, then the people in the business.
export default function TeamSettingsLoading() {
  return (
    <LoadingScreen label="Loading team">
      <PageHeaderSkeleton back title="w-24" description="w-96" wraps="w-32" />
      <div className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="grid gap-1">
          <TextSkeleton size="base" width="w-36" />
          <TextSkeleton width="w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start">
          <FieldSkeleton />
          <FieldSkeleton shape="half hint" />
          <div className="sm:mt-6">
            <ButtonSkeleton width="w-full sm:w-32" />
          </div>
        </div>
      </div>
      <div className="mt-8">
        <TextSkeleton size="base" width="w-16" className="mb-3" />
        <ListSkeleton
          rows={2}
          row={(i) => (
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <TextSkeleton size="base" width={vary(["w-40", "w-32"], i)} />
                <TextSkeleton width={vary(["w-56", "w-48"], i)} />
              </div>
              <TextSkeleton width="w-16" />
            </div>
          )}
        />
      </div>
    </LoadingScreen>
  );
}
