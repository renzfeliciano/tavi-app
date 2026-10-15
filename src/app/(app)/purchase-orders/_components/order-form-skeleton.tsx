import {
  ButtonSkeleton,
  FieldSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

/**
 * The order form's real layout: the supplier sheet (picker and the add link), the details sheet (currency and two
 * dates), the items sheet (a line card, the add button, the totals), the notes sheet, then the two buttons.
 */
export function OrderFormSkeleton({ lines = 0 }: { lines?: number }) {
  return (
    <div className="mt-8 grid max-w-3xl gap-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton size="base" width="w-20" />
        <div className="grid gap-1.5 sm:max-w-sm">
          <FieldSkeleton shape="half" />
          <TextSkeleton width="w-40" />
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton size="base" width="w-16" />
        <div className="grid gap-4 sm:grid-cols-3">
          {(["half", "half", "half hint"] as const).map((shape, i) => (
            <FieldSkeleton key={i} shape={shape} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton size="base" width="w-14" />
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-lg border border-border bg-card p-3 shadow-xs @lg:p-4"
          >
            <FieldSkeleton shape="wide" />
            <div className="grid gap-3 sm:grid-cols-4">
              {(["half", "half", "half", "half"] as const).map((shape, j) => (
                <FieldSkeleton key={j} shape={shape} />
              ))}
            </div>
          </div>
        ))}
        <div>
          <ButtonSkeleton width="w-28" />
        </div>
        <div className="ml-auto grid w-full gap-1.5 sm:max-w-xs">
          {["w-16", "w-10"].map((width, i) => (
            <div key={i} className="flex justify-between gap-4">
              <TextSkeleton width={width} />
              <TextSkeleton width="w-20" />
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-border pt-1.5">
            <TextSkeleton size="base" width="w-12" />
            <TextSkeleton size="base" width="w-24" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton size="base" width="w-28" />
        <FieldSkeleton shape="textarea" />
        <FieldSkeleton shape="textarea" />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonSkeleton width="w-28" />
        <ButtonSkeleton width="w-16" />
      </div>
    </div>
  );
}
