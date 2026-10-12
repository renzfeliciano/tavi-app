import { readOrganizationFile } from "@/modules/files";
import { requireOrgContext } from "@/modules/identity";

// Serves an organization's stored file to the people allowed to see it: the
// logo to every member, a registration certificate to owners and admins.
// A logo's id changes on every upload, so it can be cached forever; a
// certificate is never cached, and PDFs download instead of opening in the page.
export async function GET(request: Request, context: RouteContext<"/api/files/[id]">) {
  const ctx = await requireOrgContext();
  const { id } = await context.params;
  const file = await readOrganizationFile(ctx, id);
  if (!file) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "Content-Length": String(file.data.byteLength),
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
  };
  if (file.purpose === "logo") {
    headers["Cache-Control"] = "private, max-age=31536000, immutable";
    headers.ETag = `"${file.sha256}"`;
    headers["Content-Disposition"] = "inline";
  } else {
    const download = file.contentType === "application/pdf" || new URL(request.url).searchParams.has("download");
    const name = file.fileName ?? "document";
    // ASCII fallback plus the UTF-8 name, so a name with accents or Filipino letters survives.
    const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    headers["Cache-Control"] = "private, no-store";
    headers["Content-Disposition"] = `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
  }
  return new Response(new Uint8Array(file.data), { headers });
}
