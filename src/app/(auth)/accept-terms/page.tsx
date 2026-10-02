import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { formatLegalDate } from "@/components/legal/legal-document";
import { LEGAL } from "@/config/legal";
import { needsTermsAcceptance, requireSession } from "@/modules/identity";
import { signOut } from "../../(app)/actions";
import { AcceptTermsForm } from "./accept-terms-form";

export const metadata: Metadata = { title: "Updated terms" };

// The app layout sends people here when the Terms of Service or Privacy
// Notice changed materially since they agreed (LEGAL.version, D15).
export default async function AcceptTermsPage() {
  const { user } = await requireSession();
  if (!needsTermsAcceptance(user.termsVersion)) redirect("/dashboard");
  return (
    <>
      <AuthHeading
        title="We've updated our terms"
        description={`The Terms of Service and Privacy Notice changed on ${formatLegalDate(LEGAL.version)}. Please read them and agree to keep using your account.`}
      />
      <AcceptTermsForm signOutAction={signOut} />
    </>
  );
}
