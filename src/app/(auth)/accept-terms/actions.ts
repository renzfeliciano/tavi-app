"use server";

import { acceptTerms, requireSession } from "@/modules/identity";

export type AcceptTermsActionResult = { ok: true } | { ok: false; error: string };

export async function acceptTermsAction(version: unknown): Promise<AcceptTermsActionResult> {
  const { user } = await requireSession();
  const result = await acceptTerms(user.id, version);
  if (result.ok) return { ok: true };
  return { ok: false, error: "These documents changed while the page was open. Reload it to read the latest version." };
}
