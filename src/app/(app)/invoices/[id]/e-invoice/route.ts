import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { eInvoiceFor } from "@/modules/reports";
import { jsonDownload } from "../../../_documents/json-download";

// One registered invoice as e-invoice JSON (D19). Billing statements and
// drafts aren't invoices, so they have none. Owners and admins only.
export async function GET(_request: Request, context: RouteContext<"/invoices/[id]/e-invoice">) {
  const ctx = await requireOrgContext();
  if (!can(ctx, "reports.read")) return new Response("Not found", { status: 404 });
  const { id } = await context.params;
  const file = await eInvoiceFor(ctx, id, { market: ctx.market });
  if (!file) return new Response("Not found", { status: 404 });
  const [invoice] = file.invoices;
  return jsonDownload(file, `e-invoice-${invoice?.serialNo ?? id}`);
}
