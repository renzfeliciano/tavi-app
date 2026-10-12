import sharp from "sharp";
import { LOGO_MAX_DIMENSION, MAX_INPUT_PIXELS, REGISTRATION_DOCUMENTS } from "../domain/limits";

export type NormalizedImage = {
  data: Buffer;
  contentType: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

/**
 * Decodes an uploaded logo and re-encodes it from pixels, which drops
 * metadata (EXIF, GPS) and anything smuggled after the image data. It is
 * rotated upright, shrunk to fit the logo box (never enlarged), and saved as
 * PNG when it has transparency, JPEG otherwise: the two formats every PDF
 * renderer and mail client reads. Throws if the bytes don't decode.
 */
export async function normalizeLogo(bytes: Uint8Array): Promise<NormalizedImage> {
  const input = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  const { hasAlpha } = await input.metadata();

  const resized = input
    .rotate()
    .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
  const { data, info } = hasAlpha
    ? await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await resized
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

  return {
    data,
    contentType: hasAlpha ? "image/png" : "image/jpeg",
    width: info.width,
    height: info.height,
  };
}

/**
 * A photo or scan of a certificate: decoded and re-encoded from pixels (no
 * EXIF or GPS, nothing hidden after the image), rotated upright, and shrunk to
 * fit 2000px so the small print stays readable. Always a JPEG on white: scans
 * have no use for transparency. Throws if the bytes don't decode.
 */
export async function normalizeDocumentImage(bytes: Uint8Array): Promise<NormalizedImage> {
  const box = REGISTRATION_DOCUMENTS.imageMaxDimension;
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate()
    .resize(box, box, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data, contentType: "image/jpeg", width: info.width, height: info.height };
}
