import {
  ListSearchSkeleton,
  ListViewsSkeleton,
  LoadingScreen,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { CatalogListSkeleton } from "../_components/catalog-list";

// Products & Services: header, the two lists' tabs, search, then the table (products, the first tab).
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
      <CatalogListSkeleton kind="product" />
    </LoadingScreen>
  );
}
