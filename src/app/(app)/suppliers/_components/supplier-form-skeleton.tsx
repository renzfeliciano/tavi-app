import { FormSkeleton } from "@/components/skeletons";

/** SupplierForm's shape: who they are, address and tax number, notes. */
export function SupplierFormSkeleton({ className = "mt-8" }: { className?: string }) {
  return (
    <div className={`${className} max-w-3xl`}>
      <FormSkeleton
        sections={[
          ["half hint", "half", "half", "half"],
          ["half", "half", "half", "half", "half", "half hint"],
          ["textarea hint"],
        ]}
      />
    </div>
  );
}
