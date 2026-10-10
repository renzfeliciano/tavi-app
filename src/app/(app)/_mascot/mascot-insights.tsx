import type { OrgContext } from "@/modules/identity";
import { gatherFacts } from "./gather-facts";
import { insightsFrom } from "./insights";
import { MascotCompanion } from "./mascot-companion";

/**
 * Streams in behind the page (the layout wraps it in Suspense with no
 * fallback), so it never delays content or the existing skeletons. If counting
 * fails for any reason the Stamp simply stays quiet.
 */
export async function MascotInsights({ ctx }: { ctx: OrgContext }) {
  let insights;
  try {
    insights = insightsFrom(await gatherFacts(ctx));
  } catch {
    return null;
  }
  return <MascotCompanion insights={insights} />;
}
