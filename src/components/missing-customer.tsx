import { UserRoundPlusIcon } from "lucide-react";

/** A draft with no customer yet: said plainly, so it reads as "next step", not as missing data. */
export function MissingCustomer() {
  return (
    <span className="inline-flex items-center gap-1.5 text-warning-strong">
      <UserRoundPlusIcon aria-hidden="true" className="size-4 shrink-0" />
      Choose a customer
    </span>
  );
}
