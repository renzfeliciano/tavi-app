import { Skeleton } from "@/components/ui/skeleton";
import {
  ButtonSkeleton,
  FormSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SectionHeadSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// Registration: the way back, the header, the tax-ID card, the coming-up list, the form, then the certificates.
export default function RegistrationSettingsLoading() {
  return (
    <LoadingScreen label="Loading registration">
      <PageHeaderSkeleton back title="w-36" description={["w-120", "w-40"]} />
      <div className="mt-8 grid max-w-3xl gap-8">
        <div className="grid gap-2 rounded-xl border border-border bg-card px-5 py-4 shadow-xs sm:px-6">
          <TextSkeleton width="w-40" size="base" />
          <TextSkeleton width="w-56" />
          <TextSkeleton width="w-48" />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <SectionHeadSkeleton title="w-28" description="w-72" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 sm:px-6">
              <Skeleton className="size-9 rounded-md" />
              <div className="grid flex-1 gap-1">
                <TextSkeleton width="w-56" />
                <TextSkeleton width="w-44" />
              </div>
              <TextSkeleton width="w-24" />
            </div>
          ))}
        </div>
        <FormSkeleton sections={[["half", "half", "half", "half hint", "half hint", "half hint"], ["half", "half", "half", "half"]]} />
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <SectionHeadSkeleton title="w-28" description="w-80" />
          <div className="flex items-center gap-2 px-5 py-4 sm:px-6">
            <Skeleton className="h-9 w-72 rounded-md" />
            <ButtonSkeleton width="w-28" />
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
