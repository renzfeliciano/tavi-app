import { LoadingScreen, PageHeaderSkeleton } from "@/components/skeletons";
import { CatalogItemFormSkeleton } from "../../_components/catalog-item-form-skeleton";

// A product or service: the way back, its name and archive button, then its form.
export default function CatalogItemLoading() {
  return (
    <LoadingScreen label="Loading product or service">
      <PageHeaderSkeleton back title="w-48" description="w-64" actions={["w-28"]} />
      <CatalogItemFormSkeleton />
    </LoadingScreen>
  );
}
