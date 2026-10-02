import { FormSkeleton } from "@/components/skeletons";

/** CustomerForm's shape: who they are, billing details, notes. */
export function CustomerFormSkeleton() {
  return (
    <div className="mt-8 max-w-3xl">
      <FormSkeleton
        sections={[
          ["half hint", "half", "half hint", "half"],
          ["half", "half", "half", "half", "half", "half hint", "half hint"],
          ["textarea hint"],
        ]}
      />
    </div>
  );
}
