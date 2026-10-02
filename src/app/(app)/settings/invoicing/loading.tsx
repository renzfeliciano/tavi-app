import {
  ButtonSkeleton,
  FieldSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  ParagraphSkeleton,
  SectionHeadSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// Invoice registration: the way back, the header, whether it's on, then the registration form.
export default function InvoicingSettingsLoading() {
  return (
    <LoadingScreen label="Loading invoice registration">
      <PageHeaderSkeleton back title="w-52" description={["w-128", "w-72"]} wraps="w-48" />
      <div className="mt-8 grid max-w-3xl gap-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs sm:px-6">
          <TextSkeleton size="base" width="w-72" />
          <div className="mt-1">
            <ParagraphSkeleton lines={2} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <SectionHeadSkeleton title="w-48" description="w-56" />
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <FieldSkeleton shape="wide hint" />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton shape="half hint" />
            <FieldSkeleton />
            <div className="flex justify-end sm:col-span-2">
              <ButtonSkeleton width="w-full sm:w-36" />
            </div>
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
