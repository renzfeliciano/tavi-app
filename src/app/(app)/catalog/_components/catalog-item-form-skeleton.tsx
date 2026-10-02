import { FormSkeleton } from "@/components/skeletons";

/** CatalogItemForm's shape: how it appears on documents, then its price. */
export function CatalogItemFormSkeleton() {
  return (
    <div className="mt-8 max-w-3xl">
      <FormSkeleton
        sections={[
          ["wide", "textarea hint", "half hint"],
          ["half", "half", "half hint", "half hint"],
        ]}
      />
    </div>
  );
}
