import { BadgeSkeleton, TextSkeleton, vary } from "@/components/skeletons";

/** A row of the quote and bill lists: customer with number and date beneath, status and amount at the right. */
export function DocumentRowSkeleton({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:px-6">
      <div className="min-w-0">
        <TextSkeleton size="base" width={vary(["w-40", "w-32", "w-48"], index)} />
        <TextSkeleton width="w-36" />
      </div>
      <div className="flex flex-col items-end gap-1.5 sm:flex-row-reverse sm:items-center sm:gap-5">
        <TextSkeleton width="w-20" />
        <BadgeSkeleton />
      </div>
    </div>
  );
}
