import { z } from "zod";

// What an organization may customize about its document numbers (§B.6):
// the prefix and how many digits. The sequence itself is never editable.
export const numberingInputSchema = z.object({
  prefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : ""),
    z.string().regex(/^[A-Z0-9-]{0,12}$/, { error: "Use up to 12 letters, digits or dashes." }),
  ),
  padding: z.preprocess(
    (v) => Number(v),
    z
      .number({ error: "Choose between 3 and 10 digits." })
      .int({ error: "Choose between 3 and 10 digits." })
      .min(3, { error: "Choose between 3 and 10 digits." })
      .max(10, { error: "Choose between 3 and 10 digits." }),
  ),
});

export type NumberingInput = z.infer<typeof numberingInputSchema>;
