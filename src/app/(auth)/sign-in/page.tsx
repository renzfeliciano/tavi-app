import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { getCurrentSession } from "@/modules/identity";
import { invitationReturnPath } from "@/modules/organizations";
import { SESSION_POLICY } from "@/modules/identity/client";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  // Only a well-formed invitation path is followed (invitationReturnPath).
  const params = await searchParams;
  const next = (invitationReturnPath(params.invite) ?? undefined) as Route | undefined;
  if (await getCurrentSession()) redirect(next ?? "/dashboard");
  return (
    <>
      <AuthHeading title="Sign in to" withBrand />
      {params.reason === "idle" && (
        <p role="status" className="-mt-4 mb-6 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm text-pretty">
          You were signed out after {Math.round(SESSION_POLICY.idleTimeoutSeconds / 60)} minutes of inactivity. Sign in to pick up where you left off.
        </p>
      )}
      {params.reason === "signed-out" && (
        <p role="status" className="-mt-4 mb-6 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm text-pretty">
          You&apos;re signed out. Your session has ended on this device.
        </p>
      )}
      <SignInForm next={next} />
    </>
  );
}
