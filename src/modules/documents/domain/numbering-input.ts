import { z } from "zod";

export const NUMBERING_LIMITS = {
  /** Also enforced by a database check on document_sequences. */
  prefixMaxLength: 12,
  padding: { min: 3, max: 10 },
} as const;

const { prefixMaxLength, padding } = NUMBERING_LIMITS;
const PREFIX = new RegExp(`^[A-Z0-9-]{0,${prefixMaxLength}}$`);
const PADDING_ERROR = `Choose between ${padding.min} and ${padding.max} digits.`;

// What an organization may customize about its document numbers (§B.6):
// the prefix and how many digits. The sequence itself is never editable.
export const numberingInputSchema = z.object({
  prefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : ""),
    z.string().regex(PREFIX, { error: `Use up to ${prefixMaxLength} letters, digits or dashes.` }),
  ),
  padding: z.preprocess(
    (v) => Number(v),
    z
      .number({ error: PADDING_ERROR })
      .int({ error: PADDING_ERROR })
      .min(padding.min, { error: PADDING_ERROR })
      .max(padding.max, { error: PADDING_ERROR }),
  ),
});

export type NumberingInput = z.infer<typeof numberingInputSchema>;
