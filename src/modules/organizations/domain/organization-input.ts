import { z } from "zod";
import { isCurrencyCode } from "@/shared/money";

/** What onboarding asks for: the business name and its currency (§G.5). */
export const organizationInputSchema = z.object({
  name: z
    .string({ error: "Enter your business name." })
    .trim()
    .min(1, { error: "Enter your business name." })
    .max(120, { error: "Use 120 characters or fewer." }),
  currency: z
    .string({ error: "Choose a currency." })
    .refine(isCurrencyCode, { error: "Choose a currency." }),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
