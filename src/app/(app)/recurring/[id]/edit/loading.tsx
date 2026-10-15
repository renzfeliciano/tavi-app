import { FormSkeleton, LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";

// A schedule's edit page: the way back and header, then the two form sections and the save button.
export default function EditScheduleLoading() {
  return (
    <LoadingScreen label="Loading recurring statement">
      <PageHeaderSkeleton back title="w-44" description="w-96" />
      <div className="mt-8 max-w-3xl">
        <FormSkeleton sections={[["wide", "half", "wide", "half", "half"], ["half hint", "textarea", "textarea"]]} />
      </div>
    </LoadingScreen>
  );
}
