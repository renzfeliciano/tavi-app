// Identifies uploads by their bytes, never by file name or declared type (§I).
// Only raster formats we can safely re-encode are accepted; SVG is refused
// because it can carry scripts.

export type AcceptedImageType = "image/png" | "image/jpeg" | "image/webp";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, i) => bytes[offset + i] === value);

export function detectImageType(bytes: Uint8Array): AcceptedImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}
