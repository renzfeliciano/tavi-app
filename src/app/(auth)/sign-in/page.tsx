import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/components/auth-shell";
import { brand } from "@/config/brand";
import { getCurrentSession } from "@/modules/identity";
import { invitationReturnPath } from "@/modules/organizations";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  // Only a well-formed invitation path is followed (invitationReturnPath).
  const next = (invitationReturnPath((await searchParams).invite) ?? undefined) as Route | undefined;
  if (await getCurrentSession()) redirect(next ?? "/dashboard");
  return (
    <>
      <AuthHeading title={`Sign in to ${brand.name}`} />
      <SignInForm next={next} />
    </>
  );
}
