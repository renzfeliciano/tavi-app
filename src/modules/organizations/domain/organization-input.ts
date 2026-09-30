import { z } from "zod";
import { DEFAULT_MARKET, isMarketCode } from "@/config/markets";
import { isCurrencyCode } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";
import { BUSINESS_PROFILE_LIMITS } from "./limits";

/** What onboarding asks for: the business name, its currency and (when more than one market exists) its country (§G.5). */
export const organizationInputSchema = z.object({
  name: z
    .string({ error: "Enter your business name." })
    .trim()
    .min(1, { error: "Enter your business name." })
    .max(BUSINESS_PROFILE_LIMITS.name, { error: tooLong(BUSINESS_PROFILE_LIMITS.name) }),
  currency: z
    .string({ error: "Choose a currency." })
    .refine(isCurrencyCode, { error: "Choose a currency." }),
  country: z
    .string()
    .refine(isMarketCode, { error: "Choose a country." })
    .default(DEFAULT_MARKET),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
