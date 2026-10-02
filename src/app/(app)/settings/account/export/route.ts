import { can } from "@/modules/authz";
import { requireOrgContext } from "@/modules/identity";
import { exportBusinessData } from "@/modules/privacy";

// "Download your data" (D16): the whole business as one JSON file.
// Owners and admins only; anyone else gets the same answer as a missing page.
export async function GET(): Promise<Response> {
  const ctx = await requireOrgContext();
  if (!can(ctx, "organization.manage")) return new Response("Not found", { status: 404 });

  const result = await exportBusinessData(ctx);
  if (!result.ok) {
    return new Response("Too many downloads. Wait a few minutes, then try again.", {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds), "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(result.body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
