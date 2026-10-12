import { REGISTRATION_DOCUMENTS } from "./limits";

/**
 * The name a document is shown and downloaded under: just the file's own name
 * (no folders), without control characters, quotes or slashes, and no longer
 * than the limit. Falls back to `fallback` when nothing usable is left.
 */
export function cleanFileName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "").replace(/\s+/g, " ").trim();
  if (cleaned === "" || /^\.+$/.test(cleaned)) return fallback;
  const max = REGISTRATION_DOCUMENTS.fileName;
  if (cleaned.length <= max) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 8 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, max - extension.length) + extension;
}
