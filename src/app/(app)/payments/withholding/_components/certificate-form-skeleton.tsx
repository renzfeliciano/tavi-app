import { ButtonSkeleton, FieldSkeleton, FormSectionSkeleton, InputSkeleton, SectionHeadSkeleton, TextSkeleton } from "@/components/skeletons";

/**
 * The 2307 form's real layout: the payor and period sheets, one row of income
 * and tax, the payments it covers, the scan and notes sheet, then the buttons.
 */
export function CertificateFormSkeleton() {
  return (
    <div className="mt-8 grid max-w-3xl gap-5">
      <FormSectionSkeleton fields={["half", "half", "wide"]} />
      <FormSectionSkeleton fields={["half", "half", "half"]} />
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <SectionHeadSkeleton />
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSkeleton shape="half" />
            <FieldSkeleton shape="half" />
            <FieldSkeleton shape="wide" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid content-start gap-2">
                <TextSkeleton width="w-20" />
                <InputSkeleton />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextSkeleton width="w-52" />
            <FieldSkeleton shape="half hint" />
          </div>
          <ButtonSkeleton width="w-32" />
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-border bg-card px-5 py-5 shadow-xs sm:px-6">
        <TextSkeleton size="base" width="w-44" />
        <TextSkeleton width="w-80" />
        <TextSkeleton width="w-72" />
        <TextSkeleton width="w-64" />
      </div>
      <FormSectionSkeleton fields={["wide", "textarea"]} />
      <div className="flex flex-wrap items-center gap-2">
        <ButtonSkeleton width="w-28" />
        <ButtonSkeleton width="w-20" />
      </div>
    </div>
  );
}
