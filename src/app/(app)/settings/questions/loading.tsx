import {
  ButtonSkeleton,
  FieldSkeleton,
  FormSectionSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SectionHeadSkeleton,
  TextSkeleton,
} from "@/components/skeletons";

// RDO and CPA questions: the way back, the header, the facts section, the numbered questions with their fields, the
// save bar (with the download beside it) and the closing note.
export default function QuestionsLoading() {
  return (
    <LoadingScreen label="Loading the worksheet">
      <PageHeaderSkeleton back title="w-48" description={["w-120", "w-40"]} />
      <div className="mt-8 grid max-w-3xl gap-8">
        <div className="grid gap-8">
          <FormSectionSkeleton fields={["half hint", "half", "half", "half hint"]} />
          <div className="rounded-xl border border-border bg-card shadow-xs">
            <SectionHeadSkeleton title="w-32" description="w-80" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:px-6">
                <div className="grid gap-1.5">
                  <TextSkeleton width="w-full" />
                  <TextSkeleton width="w-2/3" />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FieldSkeleton shape="textarea" />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldSkeleton shape="textarea" />
                  </div>
                  <FieldSkeleton shape="half" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
          <TextSkeleton width="w-32" />
          <div className="flex items-center gap-2">
            <ButtonSkeleton width="w-32" />
            <ButtonSkeleton width="w-32" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <TextSkeleton width="w-full" />
          <TextSkeleton width="w-3/4" />
        </div>
      </div>
    </LoadingScreen>
  );
}
