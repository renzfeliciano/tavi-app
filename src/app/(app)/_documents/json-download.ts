import "server-only";

/** "e-invoice 0007" → "e-invoice-0007" (ASCII only, safe in a header). */
export function jsonFileName(name: string): string {
  const safe = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "export"}.json`;
}

/** Data as a JSON download: private, never cached or indexed (it holds customers' details). */
export function jsonDownload(data: unknown, name: string): Response {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${jsonFileName(name)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
