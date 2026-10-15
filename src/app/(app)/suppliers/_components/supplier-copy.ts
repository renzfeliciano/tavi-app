import type { OrgContext } from "@/modules/identity";
import type { SupplierFormCopy } from "./supplier-form";

/** The supplier form's wording, from the business's market. */
export function supplierFormCopy(ctx: OrgContext): SupplierFormCopy {
  return {
    taxIdLabel: ctx.market.taxId.label,
    taxIdExample: ctx.market.taxId.example,
    examples: ctx.market.examples,
    address: ctx.market.address,
  };
}
