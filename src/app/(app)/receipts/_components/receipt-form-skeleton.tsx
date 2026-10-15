import { ButtonSkeleton, FieldSkeleton, InputSkeleton, TextSkeleton } from "@/components/skeletons";

/**
 * The New receipt form's real layout: the "Who paid" sheet (title, payer choice, customer picker, name), the
 * "The money" sheet (amount, date, purpose, method details, notes), the email sheet, then the button.
 */
export function ReceiptFormSkeleton() {
  return (
    <div className="mt-8 grid max-w-3xl gap-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton size="base" width="w-24" />
        <div className="sm:max-w-sm">
          <FieldSkeleton shape="half" />
        </div>
        <div className="grid gap-2">
          <TextSkeleton width="w-28" />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <TextSkeleton width="w-28" />
            <TextSkeleton width="w-28" />
          </div>
        </div>
        <div className="sm:max-w-sm">
          <FieldSkeleton shape="half" />
        </div>
        <div className="sm:max-w-sm">
          <FieldSkeleton shape="half hint" />
        </div>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton size="base" width="w-28" />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["half", "half", "wide", "half", "half", "half", "half", "textarea"] as const).map((shape, i) => (
            <FieldSkeleton key={i} shape={shape} />
          ))}
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <TextSkeleton width="w-28" />
        <div className="grid gap-1.5">
          <TextSkeleton width="w-64" />
          <div className="flex gap-2">
            <InputSkeleton className="flex-1" />
            <ButtonSkeleton width="w-16" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ButtonSkeleton width="w-32" />
        <TextSkeleton width="w-96" />
      </div>
    </div>
  );
}
