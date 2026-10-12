import QRCode from "qrcode";

// QR codes drawn from text, with no image to store or host. The matrix feeds
// every place a code is shown: an inline SVG on the page and vector shapes in
// the PDF. Safe for the browser (the PNG for email is in qr-png.ts, server only).

export type QrMatrix = {
  /** Modules per side (21 for the smallest code). */
  size: number;
  isDark(row: number, col: number): boolean;
};

// Medium error correction: reads reliably from a screen or a printout, and
// keeps long payment links at a size phones scan easily.
export const QR_LEVEL = "M" as const;

export function qrMatrix(value: string): QrMatrix {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: QR_LEVEL });
  return { size: modules.size, isDark: (row, col) => modules.get(row, col) === 1 };
}

/**
 * The dark modules as one SVG path of horizontal runs (`M x y h<run> v1 h-<run> z`),
 * in module units: draw it in a `viewBox="0 0 size size"`.
 */
export function qrPath(matrix: QrMatrix): { d: string; size: number } {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < matrix.size && matrix.isDark(row, col)) col++;
      const run = col - start;
      parts.push(`M${start} ${row}h${run}v1h-${run}z`);
    }
  }
  return { d: parts.join(""), size: matrix.size };
}

/** Whether the text can be drawn as a QR code (it fits within what a code can hold). */
export function canDrawQr(value: string): boolean {
  try {
    qrMatrix(value);
    return true;
  } catch {
    return false;
  }
}
