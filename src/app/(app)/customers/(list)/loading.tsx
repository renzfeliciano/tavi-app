import {
  ListSearchSkeleton,
  ListSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
  vary,
} from "@/components/skeletons";

// The customer list: header, search, then rows of name, contact and city.
export default function CustomersLoading() {
  return (
    <LoadingScreen label="Loading customers">
      <PageHeaderSkeleton title="w-40" description="w-72" actions={["w-36"]} />
      <div className="mt-8">
        <ListSearchSkeleton />
      </div>
      <ListSkeleton
        className="mt-4"
        row={(i) => (
          <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-6">
            <div>
              <TextSkeleton size="base" width={vary(["w-40", "w-32", "w-48"], i)} />
              <TextSkeleton width={vary(["w-28", "w-36", "w-24"], i)} />
            </div>
            <TextSkeleton width={vary(["w-48", "w-40", "w-44"], i)} />
            <TextSkeleton width="w-20" className="hidden sm:flex" />
          </div>
        )}
      />
    </LoadingScreen>
  );
}
