import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CatalogItemFormSkeleton } from "../../_components/catalog-item-form-skeleton";

// Adding a product or service: the way back, the header, then the empty form.
export default function NewCatalogItemLoading() {
  return (
    <LoadingScreen label="Loading new product or service form">
      <PageHeaderSkeleton back title="w-44" description="w-96" wraps="w-24" />
      <CatalogItemFormSkeleton />
    </LoadingScreen>
  );
}
