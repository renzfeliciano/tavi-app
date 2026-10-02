import {
  ButtonSkeleton,
  FieldSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// Document numbers: the way back, the header, then one card per kind of document.
export default function NumberingSettingsLoading() {
  return (
    <LoadingScreen label="Loading document numbers">
      <PageHeaderSkeleton back title="w-48" description={["w-120", "w-28"]} />
      <div className="mt-8 grid max-w-3xl gap-4">
        {["w-20", "w-24", "w-36"].map((title) => (
          <div key={title} className="rounded-xl border border-border bg-card shadow-xs">
            <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="grid gap-0.5">
                <TextSkeleton size="base" width={title} />
                <TextSkeleton width="w-64" />
              </div>
              <TextSkeleton width="w-28" />
            </div>
            <div className="grid gap-4 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 flex-wrap items-start gap-4">
                <div className="w-full sm:w-64">
                  <FieldSkeleton shape="half hint" />
                </div>
                <div className="w-24">
                  <FieldSkeleton />
                </div>
                <div className="w-full sm:mt-6 sm:ml-auto sm:w-auto">
                  <ButtonSkeleton width="w-full sm:w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LoadingScreen>
  );
}
