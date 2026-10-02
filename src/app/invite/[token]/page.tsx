import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { getCurrentSession } from "@/modules/identity";
import { previewInvitation, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/organizations";
import { consumeRateLimit } from "@/modules/system";
import { clientIp } from "@/shared/http/client-ip";
import { signOut } from "../../(app)/actions";
import { AcceptInvitationButton } from "./accept-button";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

/** Invitation lookups per IP per minute; the token is the only key. */
const INVITATION_RATE_LIMIT = { windowSeconds: 60, max: 30 };

const UNAVAILABLE = {
  title: "This invitation can't be used",
  body: "It may have expired, been cancelled or already been accepted. Ask the business to invite you again.",
};

// A team invitation (Phase 2.1, D17). Anyone with the link sees who invited
// them; joining needs an account with the invited email.
export default async function InvitationPage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const limit = await consumeRateLimit(`invite:${clientIp(await headers())}`, INVITATION_RATE_LIMIT);
  const invitation = limit.allowed ? await previewInvitation(token) : null;

  if (!limit.allowed) {
    return (
      <AuthShell>
        <AuthHeading title="Too many requests" description="Please wait a minute, then open the link again." />
      </AuthShell>
    );
  }
  if (!invitation || invitation.state !== "open") {
    return (
      <AuthShell>
        <AuthHeading title={UNAVAILABLE.title} description={UNAVAILABLE.body} />
      </AuthShell>
    );
  }

  const session = await getCurrentSession();
  const who = invitation.inviterName ? `${invitation.inviterName} invited you` : "You're invited";
  const role = ROLE_LABELS[invitation.role];
  const heading = (
    <AuthHeading
      title={`Join ${invitation.businessName}`}
      description={`${who} to work in ${invitation.businessName} on ${brand.name} as ${role === "Admin" ? "an" : "a"} ${role.toLowerCase()}. ${ROLE_DESCRIPTIONS[invitation.role]}`}
    />
  );
  const next = encodeURIComponent(token);

  if (!session) {
    return (
      <AuthShell>
        {heading}
        <div className="grid gap-3">
          <p className="text-sm text-pretty text-muted-foreground">
            The invitation is for <span className="font-medium text-foreground">{invitation.email}</span>. Use that
            address to create your account or sign in.
          </p>
          <Link href={`/sign-up?invite=${next}`} className={buttonVariants({ size: "lg" })}>
            Create an account
          </Link>
          <Link href={`/sign-in?invite=${next}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (session.user.email.toLowerCase() !== invitation.email) {
    return (
      <AuthShell>
        {heading}
        <div className="grid gap-4">
          <p className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-pretty">
            You&apos;re signed in as <span className="font-medium">{session.user.email}</span>, but this invitation is
            for <span className="font-medium">{invitation.email}</span>. Sign out, then open the link again.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="lg" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {heading}
      <AcceptInvitationButton token={token} businessName={invitation.businessName} />
    </AuthShell>
  );
}
