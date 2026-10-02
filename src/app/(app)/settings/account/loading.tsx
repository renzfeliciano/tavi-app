import { CardSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// Account and data: the way back, the header, then the download and close-account cards.
export default function AccountSettingsLoading() {
  return (
    <LoadingScreen label="Loading account settings">
      <PageHeaderSkeleton back title="w-48" description={["w-120", "w-24"]} />
      <CardSkeleton className="mt-8" title="w-40" lines={3} action="w-44" />
      <CardSkeleton className="mt-6" title="w-36" lines={3} action="w-36" />
    </LoadingScreen>
  );
}
