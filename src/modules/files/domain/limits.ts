// What the files module accepts (docs/foundation-proposal.md §I).

export const FILE_PURPOSES = ["logo"] as const;
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

/** Largest file we store (after re-encoding); a database check enforces it too. */
export const MAX_STORED_FILE_BYTES = 1024 * 1024;

/** Logos are shrunk to fit this box, which is plenty for documents and the app. */
export const LOGO_MAX_DIMENSION = 600;

/** Refuse decompression bombs: anything beyond this many pixels isn't a logo. */
export const MAX_INPUT_PIXELS = 40_000_000;
