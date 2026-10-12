import {
  ButtonSkeleton,
  ListSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  SectionHeadSkeleton,
  TextSkeleton,
  vary,
} from "@/components/skeletons";

// The recycle bin: the way back, the header, the deleted drafts (title, when, days left, buttons), then archived records.
export default function RecycleBinLoading() {
  const row = (i: number) => (
    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
      <div className="grid gap-1">
        <TextSkeleton size="base" width={vary(["w-56", "w-44", "w-64"], i)} />
        <TextSkeleton width={vary(["w-40", "w-48", "w-36"], i)} />
      </div>
      <ButtonSkeleton width="w-24" />
    </div>
  );
  return (
    <LoadingScreen label="Loading the recycle bin">
      <PageHeaderSkeleton back title="w-48" description="w-96" actions={["w-40"]} />
      <div className="mt-8 grid gap-8">
        <section>
          <SectionHeadSkeleton title="w-36" description="w-64" />
          <ListSkeleton className="mt-4" rows={3} row={row} />
        </section>
        <section>
          <SectionHeadSkeleton title="w-28" description="w-72" />
          <ListSkeleton className="mt-4" rows={2} row={row} />
        </section>
      </div>
    </LoadingScreen>
  );
}
