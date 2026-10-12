// What the files module accepts (docs/foundation-proposal.md §I).

export const FILE_PURPOSES = ["logo", "registration", "withholding_certificate"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** Largest upload we read at all. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Raster formats we can safely re-encode (never SVG), with their names for people. */
export const ACCEPTED_IMAGES = [
  { type: "image/png", name: "PNG" },
  { type: "image/jpeg", name: "JPG" },
  { type: "image/webp", name: "WebP" },
] as const;

/** "PNG, JPG or WebP" */
export const ACCEPTED_IMAGE_NAMES = ACCEPTED_IMAGES.map((i) => i.name)
  .join(", ")
  .replace(/, ([^,]*)$/, " or $1");

/** "2 MB": whole megabytes, for copy. */
export const MAX_UPLOAD_SIZE_LABEL = `${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`;

export const UPLOAD_MESSAGES = {
  empty: "Choose an image to upload.",
  tooLarge: `That image is over ${MAX_UPLOAD_SIZE_LABEL}. Try a smaller one.`,
  wrongType: `Upload a ${ACCEPTED_IMAGE_NAMES} image.`,
} as const;

/** Largest logo we store (after re-encoding). */
export const MAX_STORED_FILE_BYTES = 1024 * 1024;

/** Largest file of any purpose; a database check enforces it. */
export const MAX_FILE_BYTES = MAX_UPLOAD_BYTES;

/** Logos are shrunk to fit this box, which is plenty for documents and the app. */
export const LOGO_MAX_DIMENSION = 600;

/** Refuse decompression bombs: anything beyond this many pixels isn't a logo. */
export const MAX_INPUT_PIXELS = 40_000_000;

/** The business's certificate folder (BIR, DTI, permits): scans, photos and PDFs. */
export const REGISTRATION_DOCUMENTS = {
  /** Most documents a business keeps. */
  maxPerBusiness: 8,
  /** Photos are shrunk to fit this box: enough to read small print. */
  imageMaxDimension: 2000,
  fileName: 120,
  /** A PDF is stored as it came, so it has to fit under the upload limit. */
  maxPdfBytes: MAX_UPLOAD_BYTES,
} as const;

export const DOCUMENT_MESSAGES = {
  empty: "Choose a file to upload.",
  tooLarge: `That file is over ${MAX_UPLOAD_SIZE_LABEL}. Try a smaller scan or a photo.`,
  wrongType: "Upload a PDF, or a PNG, JPG or WebP image.",
  kind: "Choose what kind of document this is.",
  full: `You can keep up to ${REGISTRATION_DOCUMENTS.maxPerBusiness} documents. Remove one first.`,
  unreadable: "We couldn't read that file. Try saving it again as a PDF or a JPG.",
} as const;
