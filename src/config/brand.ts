/**
 * TAVI product identity. The single source for the product name and taglines,
 * so no surface hard-codes them.
 *
 * Convention (docs/foundation-proposal.md §P, open decision Q.1):
 * - `wordmark` ("TAVI") is only for the logo lockup.
 * - `name` ("Tavi") is for running text: titles, emails, sentences.
 *
 * A customer's business branding always leads on its own quotes, invoices and
 * portals. TAVI appears there only as a small "Sent with Tavi" footer.
 */
export const brand = {
  name: "Tavi",
  wordmark: "TAVI",
  description: "Simple quoting and invoicing for modern small businesses.",
  taglines: {
    primary: "Create. Send. Get paid.",
    secondary: "Simple invoicing for modern businesses.",
  },
  /**
   * Email clients can't read CSS variables, so emails use these sRGB values
   * of the Carbon Copy tokens (DESIGN.md): ink, muted ink and stamp violet.
   */
  emailColors: { ink: "#1f2130", muted: "#6b6e7c", accent: "#4b3aa8", onAccent: "#ffffff" },
} as const;

export type Brand = typeof brand;
