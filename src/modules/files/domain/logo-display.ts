// How big a business logo is drawn (one rule for the Settings preview, the web
// documents, the customer's page and the PDFs). The upload step already
// shrinks a logo to fit LOGO_MAX_DIMENSION, but a very wide or very tall logo
// is still far bigger than the letterhead, so every surface fits it into a box
// here instead of trusting CSS to cope: the same ratio-preserving result
// everywhere, never stretched, cropped or enlarged.

export type LogoSize = { width: number; height: number };

/** The letterhead's logo box per surface, in CSS px (PDF: points). */
export const LOGO_BOXES = {
  /** The document on screen, the portal and the Settings preview. */
  document: { width: 192, height: 64 },
  /** The PDF letterhead sits beside the document number, so it is a little smaller. */
  pdf: { width: 170, height: 52 },
} as const satisfies Record<string, LogoSize>;

/** Beyond this ratio (either way) a logo prints at less than half the box height. */
export const LOGO_EXTREME_RATIO = 6;

const isSide = (n: number) => Number.isFinite(n) && n > 0;

/**
 * The largest size that fits `box` with the logo's own aspect ratio, never
 * larger than the logo itself and never a zero side. Null when either size
 * can't describe a picture.
 */
export function fitLogo(natural: LogoSize, box: LogoSize): LogoSize | null {
  if (!isSide(natural.width) || !isSide(natural.height) || !isSide(box.width) || !isSide(box.height)) return null;
  const scale = Math.min(1, box.width / natural.width, box.height / natural.height);
  return {
    width: Math.min(box.width, Math.max(1, Math.round(natural.width * scale))),
    height: Math.min(box.height, Math.max(1, Math.round(natural.height * scale))),
  };
}

/** Whether a logo is so wide or tall that it will print tiny (worth a hint when it's uploaded). */
export function logoLooksExtreme(natural: LogoSize): boolean {
  if (!isSide(natural.width) || !isSide(natural.height)) return false;
  const ratio = natural.width / natural.height;
  return ratio >= LOGO_EXTREME_RATIO || ratio <= 1 / LOGO_EXTREME_RATIO;
}
