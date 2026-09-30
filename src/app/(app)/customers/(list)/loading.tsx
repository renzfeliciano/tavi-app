import { Skeleton } from "@/components/ui/skeleton";

// Matches the customer list: header, search row, then rows.
export default function CustomersLoading() {
  return (
    <div aria-busy="true" aria-label="Loading customers">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-8 h-9 w-full sm:max-w-sm" />
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="grid gap-2 px-5 py-4 sm:grid-cols-[2fr_2fr_1fr] sm:px-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
