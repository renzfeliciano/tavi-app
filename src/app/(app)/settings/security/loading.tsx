import { Skeleton } from "@/components/ui/skeleton";
import {
  ButtonSkeleton,
  ListSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
  vary,
} from "@/components/skeletons";

// Security: header, then the signed-in devices, this one first, and the session note.
export default function SecuritySettingsLoading() {
  return (
    <LoadingScreen label="Loading signed-in devices">
      <PageHeaderSkeleton title="w-32" description="w-96" wraps="w-24" actions={["w-44"]} />
      <ListSkeleton
        rows={2}
        className="mt-8"
        row={(i) => (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-3">
              <Skeleton className="mt-0.5 size-5 shrink-0" />
              <div className="grid gap-0.5">
                <TextSkeleton size="base" width={vary(["w-48", "w-40"], i)} />
                <TextSkeleton width="w-72" />
              </div>
            </div>
            {i > 0 && <ButtonSkeleton width="w-24" />}
          </div>
        )}
      />
      <TextSkeleton width="w-96" className="mt-3" />
    </LoadingScreen>
  );
}
