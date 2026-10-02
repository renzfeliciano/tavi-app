import { BadgeSkeleton, TextSkeleton, vary } from "@/components/skeletons";

/** A row of the quote and bill lists: number, customer and date, status, amount. */
export function DocumentRowSkeleton({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto_auto] sm:px-6">
      <TextSkeleton width="w-20" />
      <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
        <TextSkeleton size="base" width={vary(["w-40", "w-32", "w-48"], index)} />
        <TextSkeleton width="w-24" />
      </div>
      <div className="justify-self-end">
        <BadgeSkeleton />
      </div>
      <TextSkeleton width="w-20" className="row-start-2 justify-self-end sm:row-start-1" />
    </div>
  );
}
