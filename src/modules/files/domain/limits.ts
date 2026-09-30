// What the files module accepts (docs/foundation-proposal.md §I).

export const FILE_PURPOSES = ["logo"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/** Largest upload we read at all. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Largest file we store (after re-encoding); a database check enforces it too. */
export const MAX_STORED_FILE_BYTES = 1024 * 1024;

/** Logos are shrunk to fit this box, which is plenty for documents and the app. */
export const LOGO_MAX_DIMENSION = 600;

/** Refuse decompression bombs: anything beyond this many pixels isn't a logo. */
export const MAX_INPUT_PIXELS = 40_000_000;
