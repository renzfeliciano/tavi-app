import {
  ButtonSkeleton,
  InputSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// Reports: header, the period tabs and dates, then sales, payments and unpaid
// bills, each with its heading, download button, figures and rows.
export default function ReportsLoading() {
  return (
    <LoadingScreen label="Loading reports">
      <PageHeaderSkeleton title="w-32" description="w-96" wraps="w-24" />
      <div className="mt-8 grid gap-4">
        <ListViewsSkeleton views={["w-24", "w-24", "w-28", "w-28", "w-20", "w-20"]} />
        <div className="flex flex-wrap items-end gap-3">
          {["w-10", "w-6"].map((label) => (
            <div key={label} className="grid gap-2">
              <TextSkeleton width={label} />
              <InputSkeleton className="w-44" />
            </div>
          ))}
          <ButtonSkeleton width="w-16" />
        </div>
        <TextSkeleton width="w-56" />
      </div>
      {[3, 2, 6].map((figures, i) => (
        <div key={i} className="mt-10 grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-0.5">
              <TextSkeleton size="base" width="w-36" />
              <TextSkeleton width="w-96" />
            </div>
            <ButtonSkeleton width="w-36" />
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
            {Array.from({ length: figures }, (_, j) => (
              <div key={j} className="bg-card px-5 py-4">
                <TextSkeleton width="w-28" />
                <TextSkeleton size="2xl" width="w-32" className="mt-1" />
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="border-b border-border px-5 py-3 sm:px-6">
              <TextSkeleton width="w-40" />
            </div>
            {["w-40", "w-32", "w-48"].map((width) => (
              <div key={width} className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-0 sm:px-6">
                <TextSkeleton width={width} />
                <TextSkeleton width="w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </LoadingScreen>
  );
}
