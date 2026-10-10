import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { getCurrentSession } from "@/modules/identity";
import { invitationReturnPath } from "@/modules/organizations";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  // Only a well-formed invitation path is followed (invitationReturnPath).
  const next = (invitationReturnPath((await searchParams).invite) ?? undefined) as Route | undefined;
  if (await getCurrentSession()) redirect(next ?? "/dashboard");
  return (
    <>
      <AuthHeading
        title="Create your account on"
        withBrand
        description="Send your first quote in a few minutes. No card needed."
      />
      <SignUpForm next={next} />
    </>
  );
}
