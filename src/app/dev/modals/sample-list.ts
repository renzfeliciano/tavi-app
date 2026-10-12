import type { MascotExpression } from "@/components/brand/brand-mascot";

// The kinds of modal the app has (DESIGN.md, "Modals"), one sample of each.
// Plain data, so the server page can check the `?sample=` it is given.

export const SAMPLES = [
  {
    id: "danger",
    title: "Delete a draft forever",
    mascot: "concerned",
    when: "Something hard to undo: delete, void, remove a member. Red edge on the card, concerned Stamp, destructive button.",
  },
  {
    id: "payment",
    title: "Record a payment",
    mascot: "curious",
    when: "A form or a question: fields in the body, the Stamp curious beside the buttons.",
  },
  {
    id: "send",
    title: "Send a quotation",
    mascot: "happy",
    when: "A send or an approval. This is the real send dialog, with sample data.",
  },
  {
    id: "idle",
    title: "Still there?",
    mascot: "waiting",
    when: "The idle-session warning: no close button, one way out, waiting Stamp.",
  },
  {
    id: "neutral",
    title: "Sign out other devices",
    mascot: "neutral",
    when: "Everything else: a plain confirmation with the neutral Stamp.",
  },
  {
    id: "long",
    title: "Tax rates (long content)",
    mascot: "curious",
    when: "More content than fits: header and footer stay in view and only the body scrolls.",
  },
] as const satisfies readonly { id: string; title: string; mascot: MascotExpression; when: string }[];

export type SampleId = (typeof SAMPLES)[number]["id"];

export function isSampleId(value: unknown): value is SampleId {
  return SAMPLES.some((sample) => sample.id === value);
}
