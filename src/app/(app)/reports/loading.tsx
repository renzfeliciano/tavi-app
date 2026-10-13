import {
  ButtonSkeleton,
  InputSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
} from "@/components/skeletons";
import { ReportSectionsSkeleton } from "./_components/report-sections-skeleton";

// Reports: header, the period tabs and dates, then sales, payments and unpaid
// bills, each with its heading, download button, figures and rows.
export default function ReportsLoading() {
  return (
    <LoadingScreen label="Loading reports">
      <PageHeaderSkeleton title="w-32" description="w-96" wraps="w-24" />
      <div className="mt-8 grid gap-4">
        <ListViewsSkeleton views={["w-24", "w-24", "w-28", "w-28", "w-20", "w-20"]} />
        <div className="flex flex-wrap items-end gap-3">
          {["w-10", "w-6"].map((label) => (
            <div key={label} className="grid gap-2">
              <TextSkeleton width={label} />
              <InputSkeleton className="w-44" />
            </div>
          ))}
          <ButtonSkeleton width="w-16" />
        </div>
        <TextSkeleton width="w-56" />
      </div>
      <ReportSectionsSkeleton />
    </LoadingScreen>
  );
}
