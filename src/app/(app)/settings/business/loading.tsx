import { Skeleton } from "@/components/ui/skeleton";
import {
  ButtonSkeleton,
  FormSkeleton,
  JumpLinksSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SectionHeadSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// Business profile: the way back, the header, the jump links, the logo and payment QR cards, then the profile form with its save bar.
export default function BusinessSettingsLoading() {
  return (
    <LoadingScreen label="Loading business profile">
      <PageHeaderSkeleton back title="w-44" description={["w-120", "w-24"]} />
      <JumpLinksSkeleton widths={["w-14", "w-32", "w-32", "w-40", "w-36", "w-32"]} />
      <div className="mt-8 grid max-w-3xl gap-8">
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <SectionHeadSkeleton title="w-12" description="w-56" />
          <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <Skeleton className="h-24 w-full max-w-60 rounded-lg" />
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                <ButtonSkeleton width="w-32" />
                <ButtonSkeleton width="w-24" />
              </div>
              <TextSkeleton width="w-56" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <SectionHeadSkeleton title="w-36" description="w-72" />
          <div className="grid gap-4 px-5 py-5 sm:px-6">
            <TextSkeleton width="w-32" />
            <div className="flex flex-wrap gap-2">
              <ButtonSkeleton width="w-36" />
              <ButtonSkeleton width="w-24" />
            </div>
          </div>
        </div>
        <FormSkeleton
          saveBar
          sections={[
            ["half hint", "half hint", "half hint", "half hint"],
            ["half", "half", "half", "half", "half", "half", "half"],
            ["half hint", "wide", "half hint", "half hint"],
            ["textarea hint", "textarea hint", "textarea hint"],
          ]}
        />
      </div>
    </LoadingScreen>
  );
}
