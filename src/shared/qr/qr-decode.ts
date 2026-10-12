import jsQR from "jsqr";

// Reading the text out of a screenshot of a payment QR, in the browser: the
// picture never leaves the person's device, and only the text inside it is
// saved. Tavi then redraws the code clean (see qr-matrix.ts).

/** Pictures are scaled down to this longest side before reading: faster, and no loss for a QR. */
const MAX_SIDE = 1600;

/** The text in a QR found in RGBA pixels, or null when there is none. Also reads light-on-dark codes. */
export function decodeQrPixels(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** The text in a QR in an image file (browser only), or null when the file has no readable code. */
export async function decodeQrFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return decodeQrPixels(data, width, height);
  } finally {
    bitmap.close();
  }
}
