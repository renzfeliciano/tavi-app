import { ButtonSkeleton, InputSkeleton, TextSkeleton } from "@/components/skeletons";

/**
 * The report sections under the period controls: sales, payments and unpaid bills, each with its heading, download
 * button, figures and rows (unpaid bills also have the age bar); and, for a market with withheld tax, the 2307 section with its year and quarter picker.
 */
export function ReportSectionsSkeleton({ withholding = true }: { withholding?: boolean }) {
  return (
    <>
      {(withholding ? [3, 2, 6, 2] : [3, 2, 6]).map((figures, i) => (
        <div key={i} className="mt-10 grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-0.5">
              <TextSkeleton size="base" width="w-36" />
              <TextSkeleton width="w-96" />
            </div>
            <ButtonSkeleton width="w-36" />
          </div>
          {withholding && i === 3 && (
            <div className="flex flex-wrap items-end gap-3">
              {["w-28", "w-56"].map((width) => (
                <div key={width} className="grid gap-2">
                  <TextSkeleton width="w-10" />
                  <InputSkeleton className={width} />
                </div>
              ))}
              <ButtonSkeleton width="w-16" />
            </div>
          )}
          <div className="grid gap-3">
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-xs sm:grid-cols-3">
              {Array.from({ length: figures }, (_, j) => (
                <div key={j} className="bg-card px-5 py-4">
                  <TextSkeleton width="w-28" />
                  <TextSkeleton size="2xl" width="w-32" className="mt-1" />
                </div>
              ))}
            </div>
            {i === 2 && (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="border-b border-border px-5 py-3 sm:px-6">
                  <TextSkeleton width="w-44" />
                </div>
                <div className="grid gap-4 px-5 py-4 sm:px-6">
                  <div className="h-3 rounded-full bg-muted" />
                  <div className="grid gap-1.5">
                    {["w-24", "w-32", "w-32", "w-32", "w-36"].map((width, k) => (
                      <div key={k} className="flex items-center gap-3">
                        <div className="size-2.5 shrink-0 rounded-sm bg-muted" />
                        <TextSkeleton width={width} className="flex-1" />
                        <TextSkeleton width="w-20" />
                        <TextSkeleton width="w-10" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
        </div>
      ))}
    </>
  );
}
