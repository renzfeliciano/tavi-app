import {
  ListSearchSkeleton,
  ListSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
  TextSkeleton,
  vary,
} from "@/components/skeletons";

// Products & Services: header, the two lists' tabs, search, then rows of name and price.
export default function CatalogLoading() {
  return (
    <LoadingScreen label="Loading products and services">
      <PageHeaderSkeleton title="w-56" description="w-96" wraps="w-32" actions={["w-36"]} />
      <div className="mt-8">
        <ListViewsSkeleton views={["w-20", "w-20"]} />
      </div>
      <div className="mt-4">
        <ListSearchSkeleton />
      </div>
      <ListSkeleton
        className="mt-4"
        row={(i) => (
          <div className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <TextSkeleton size="base" width={vary(["w-40", "w-48", "w-32"], i)} />
              <TextSkeleton width={vary(["w-56", "w-40", "w-64"], i)} />
            </div>
            <div className="shrink-0">
              <TextSkeleton width="w-20" className="justify-end" />
              <TextSkeleton width="w-14" className="justify-end" />
            </div>
          </div>
        )}
      />
    </LoadingScreen>
  );
}
