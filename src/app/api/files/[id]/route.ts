import { readLogoFile } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";

// Serves an organization's stored file (today: its logo) to its own members.
// File ids change on every upload, so responses can be cached forever.
export async function GET(_request: Request, context: RouteContext<"/api/files/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const file = await readLogoFile(ctx, id);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: `"${file.sha256}"`,
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
